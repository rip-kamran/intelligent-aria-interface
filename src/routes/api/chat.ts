import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  MODELS,
  resolveLimit,
  resolvePlan,
  canUseModel,
  USAGE_WINDOW_HOURS,
  USAGE_ROW_KEY,
  type ModelId,
  type PlanId,
} from "@/lib/aria-prompts";
import { FULL_MODEL_PROMPTS } from "@/lib/model-prompts.server";
import { createProviderModel, createLovableFallbackModel } from "@/lib/ai-gateway.server";
import { duckDuckGoSearch, fetchPageText, deepSearch } from "@/lib/search.server";
import { saveMemory, recallMemories } from "@/lib/memory.server";

function buildTools(opts: {
  userId: string;
  threadId?: string;
  webSearch: boolean;
  memory: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  if (opts.webSearch) {
    tools.web_search = tool({
      description:
        "Search the live web (DuckDuckGo + Wikipedia, merged and re-ranked). Use for real-time, recent or factual questions (news, prices, releases, anything after your training cutoff). Returns titles, URLs and snippets.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        maxResults: z.number().min(1).max(10).optional(),
      }),
      execute: async ({ query, maxResults }: { query: string; maxResults?: number }) => {
        const results = await duckDuckGoSearch(query, maxResults ?? 6);
        if (results.length === 0) return { query, results: [], note: "No results found." };
        return { query, results };
      },
    });
    tools.deep_search = tool({
      description:
        "Search the web AND read the top pages in full. Use when accuracy matters, when snippets are ambiguous, or for detailed research questions.",
      inputSchema: z.object({ query: z.string().describe("The research question") }),
      execute: async ({ query }: { query: string }) => deepSearch(query, 5),
    });
    tools.open_page = tool({
      description:
        "Open a URL returned by web_search and read its text content, when a snippet is not enough.",
      inputSchema: z.object({ url: z.string().describe("Absolute http(s) URL") }),
      execute: async ({ url }: { url: string }) => ({ url, text: await fetchPageText(url) }),
    });
  }

  if (opts.memory) {
    tools.remember = tool({
      description:
        "Save a durable fact about the user to long-term memory (their name, job, preferences, ongoing projects, goals, constraints). Only save things worth recalling in future conversations. One concise fact per call.",
      inputSchema: z.object({
        fact: z.string().describe("A concise fact, written in third person, e.g. 'Prefers TypeScript'"),
      }),
      execute: async ({ fact }: { fact: string }) => {
        const res = await saveMemory({
          userId: opts.userId,
          content: fact,
          kind: "fact",
          threadId: opts.threadId ?? null,
        });
        return res.saved ? { saved: true, fact } : { saved: false, reason: res.reason };
      },
    });
    tools.recall = tool({
      description:
        "Search the user's long-term memory for anything they told you in past conversations.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => ({
        memories: await recallMemories(opts.userId, query, 8),
      }),
    });
  }

  return tools;
}


// Built-in Aria (no personal API key) is capped per rolling window.
// Reservation happens atomically in Postgres so parallel requests can't race
// past the limit; a failed generation releases the reserved slot.
async function reserveUsage(userId: string, plan: PlanId, override: number | null) {
  const limit = resolveLimit(plan, override);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_message_quota", {
    _user_id: userId,
    _limit: limit,
    _window_hours: USAGE_WINDOW_HOURS,
  });
  if (error) {
    // Fail closed: never let a counter failure become unlimited usage.
    return {
      allowed: false,
      used: limit,
      limit,
      resetAt: new Date(Date.now() + USAGE_WINDOW_HOURS * 3600_000).toISOString(),
    };
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; used: number; reset_at: string }
    | undefined;
  return {
    allowed: row?.allowed === true,
    used: row?.used ?? limit,
    limit,
    resetAt:
      row?.reset_at ?? new Date(Date.now() + USAGE_WINDOW_HOURS * 3600_000).toISOString(),
  };
}

async function releaseUsage(userId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("release_message_quota", { _user_id: userId });
  } catch {
    /* best effort */
  }
}




type ChatBody = {
  messages?: UIMessage[];
  threadId?: string;
  model?: ModelId;
};

async function verifyAndGetSupabase(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  if (token.split(".").length !== 3) return null;

  const url = process.env.SUPABASE_URL!;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient<Database>(url, anon, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${anon}`) headers.delete("Authorization");
        headers.set("apikey", anon);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { client, userId: data.claims.sub as string };
}

/** Hard input caps — abuse guards before any model or DB work happens. */
const MAX_REQUEST_BYTES = 256_000;
const MAX_MESSAGES = 60;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/chat")({

  server: {
    handlers: {
      POST: async ({ request }) => {
        // Reject oversized payloads before parsing (cheap abuse guard).
        const declaredLength = Number(request.headers.get("content-length") ?? 0);
        if (declaredLength > MAX_REQUEST_BYTES) {
          return new Response("Message payload is too large.", { status: 413 });
        }
        const raw = await request.text();
        if (raw.length > MAX_REQUEST_BYTES) {
          return new Response("Message payload is too large.", { status: 413 });
        }
        let body: ChatBody;
        try {
          body = JSON.parse(raw) as ChatBody;
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }
        if (body.messages.length > MAX_MESSAGES) {
          body.messages = body.messages.slice(-MAX_MESSAGES);
        }
        if (body.threadId && !UUID_RE.test(body.threadId)) {
          return new Response("Invalid thread id", { status: 400 });
        }
        const auth = await verifyAndGetSupabase(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });


        // Load profile + keys (as user, RLS applies)
        const [{ data: profile }, { data: keyRows }] = await Promise.all([
          auth.client
            .from("profiles")
            .select(
              "preferred_model, custom_instructions, display_name, plan, plan_expires_at, message_limit_override, memory_enabled, web_search_enabled, response_style, response_length",
            )
            .eq("id", auth.userId)
            .maybeSingle(),
          auth.client.from("user_api_keys").select("provider, api_key"),
        ]);
        const keys: Record<string, string> = {};
        for (const r of keyRows ?? []) keys[r.provider as string] = r.api_key as string;

        const prof = (profile ?? {}) as {
          plan?: string;
          plan_expires_at?: string | null;
          message_limit_override?: number | null;
        };
        const storedPlan = (prof.plan ?? "free") as PlanId;
        // Payments aren't live, so any paid plan here was granted by an admin.
        const plan = resolvePlan(storedPlan, prof.plan_expires_at ?? null);
        const limitOverride = prof.message_limit_override ?? null;
        const requested: ModelId =
          body.model || (profile?.preferred_model as ModelId) || "prose";
        const modelId: ModelId = MODELS[requested] ? requested : "prose";
        if (!canUseModel(plan, modelId)) {
          return new Response(
            `Aria ${MODELS[modelId].label} is part of the ${MODELS[modelId].tier === "max" ? "Max" : "Pro"} plan. Upgrade to unlock it, or switch to a model included in your plan.`,
            { status: 403 },
          );
        }
        const chain = MODELS[modelId].chain;


        const prefs = (profile ?? {}) as {
          memory_enabled?: boolean;
          web_search_enabled?: boolean;
          response_style?: string;
          response_length?: string;
        };
        const memoryOn = prefs.memory_enabled !== false;
        const webSearchOn = prefs.web_search_enabled !== false;
        const ariaTools = buildTools({
          userId: auth.userId,
          threadId: body.threadId,
          webSearch: webSearchOn,
          memory: memoryOn,
        });

        // Build system prompt with custom instructions
        let system = FULL_MODEL_PROMPTS[modelId];
        if (webSearchOn) {
          system += `\n\n<tools>\nYou can browse the live web with DuckDuckGo.\n- Call web_search whenever the answer depends on current, recent, local or fast-changing information (news, prices, sports, weather, releases, "today", "latest"), or when you are unsure of a fact.\n- Call deep_search when accuracy matters or snippets are ambiguous — it reads the top pages in full.\n- Call open_page on a result URL when the snippet is not enough.\n- Prefer primary/official sources; if sources disagree, say so.\n- Never invent sources. Cite the pages you used inline as markdown links.\n- For timeless knowledge, answer directly without searching.\n</tools>`;
        }
        if (memoryOn) {
          system += `\n\n<memory>\nYou have long-term memory across conversations.\n- Call remember when the user shares a durable fact about themselves (name, role, preferences, projects, goals, constraints). Keep each memory one concise sentence.\n- Do not remember trivia, one-off questions or sensitive data unless asked.\n- Call recall when you need details from past conversations that are not in the notes below.\n- Never announce memory operations unless the user asks.\n</memory>`;
        }

        if (profile?.display_name) {
          system += `\n\nThe user's name is ${profile.display_name}.`;
        }
        if (profile?.custom_instructions?.trim()) {
          system += `\n\n<user_preferences>\n${profile.custom_instructions.trim()}\n</user_preferences>`;
        }

        const STYLE_HINTS: Record<string, string> = {
          friendly: "Warm, conversational and encouraging.",
          concise: "Answer in as few words as possible. No preamble.",
          professional: "Polished, neutral, business-appropriate tone.",
          technical: "Precise and technical; assume expert knowledge and include specifics.",
          socratic: "Guide with questions and reasoning steps before giving answers.",
        };
        const LENGTH_HINTS: Record<string, string> = {
          short: "Keep responses brief — a few sentences unless more is explicitly requested.",
          detailed: "Give thorough, well-structured responses with useful depth and examples.",
        };
        const styleHint = STYLE_HINTS[prefs.response_style ?? "default"];
        const lengthHint = LENGTH_HINTS[prefs.response_length ?? "balanced"];
        if (styleHint || lengthHint) {
          system += `\n\n<response_style>\n${[styleHint, lengthHint].filter(Boolean).join("\n")}\n</response_style>`;
        }

        // Inject relevant long-term memories for this turn.
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        const lastUserText =
          lastUser?.parts
            ?.map((p) => (p.type === "text" ? p.text : ""))
            .join(" ")
            .trim() ?? "";
        if (memoryOn && lastUserText) {
          try {
            const hits = await recallMemories(auth.userId, lastUserText, 6);
            if (hits.length > 0) {
              system += `\n\n<memory_notes>\nThings you remember about this user from past conversations:\n${hits
                .map((h) => `- ${h.content}`)
                .join("\n")}\nUse these naturally when relevant; do not recite them.\n</memory_notes>`;
            }
          } catch {
            /* memory is best-effort */
          }
        }


        // Persist user message + ensure thread exists
        const userMsg = body.messages[body.messages.length - 1];
        if (body.threadId && userMsg?.role === "user") {
          const isFirst = body.messages.length === 1;
          // Upsert thread; on first message, derive title from user text.
          const firstText =
            userMsg.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
              .trim()
              .slice(0, 80) || "New chat";
          await auth.client.from("threads").upsert(
            {
              id: body.threadId,
              user_id: auth.userId,
              model: modelId,
              ...(isFirst ? { title: firstText } : {}),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
          await auth.client.from("messages").insert({
            thread_id: body.threadId,
            user_id: auth.userId,
            role: "user",
            parts: userMsg.parts as unknown as never,
            message_id: userMsg.id,
          });
        }

        // Try providers in chain; use first with a key. Fallback to Lovable AI.
        let lastError: unknown = null;
        for (const providerId of chain) {
          const key = keys[providerId];
          if (!key) continue;
          try {
            const model = createProviderModel(providerId, key);
            const result = streamText({
              model,
              system,
              tools: ariaTools,
              stopWhen: stepCountIs(8),
              messages: convertToModelMessages(body.messages),

              onFinish: async ({ text }) => {
                if (!body.threadId) return;
                await auth.client.from("messages").insert({
                  thread_id: body.threadId,
                  user_id: auth.userId,
                  role: "assistant",
                  parts: [{ type: "text", text }],
                });
                await auth.client
                  .from("threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", body.threadId);
              },
            });
            return result.toUIMessageStreamResponse({ originalMessages: body.messages });
          } catch (e) {
            lastError = e;
            continue;
          }
        }

        // No user key worked — fallback to built-in Aria (rate limited by plan).
        const usage = await reserveUsage(auth.userId, plan, limitOverride);
        if (!usage.allowed) {
          const msLeft = new Date(usage.resetAt).getTime() - Date.now();
          const hoursLeft = Math.max(1, Math.ceil(msLeft / 3_600_000));
          return new Response(
            `You've used your full Aria allowance (${usage.limit} messages). It resets in about ${hoursLeft}h. Add your own API key in Settings for unlimited use.`,
            {
              status: 429,
              headers: {
                "Retry-After": String(Math.max(60, Math.ceil(msLeft / 1000))),
                "X-Aria-Usage-Limit": String(usage.limit),
                "X-Aria-Usage-Reset": usage.resetAt,
              },
            },
          );
        }


        try {
          const model = createLovableFallbackModel();
          const result = streamText({
            model,
            system,
            tools: ariaTools,
            stopWhen: stepCountIs(8),
            messages: convertToModelMessages(body.messages),
            onError: async () => {
              await releaseUsage(auth.userId);
            },
            onFinish: async ({ text }) => {
              if (!body.threadId) return;
              await auth.client.from("messages").insert({
                thread_id: body.threadId,
                user_id: auth.userId,
                role: "assistant",
                parts: [{ type: "text", text }],
              });
              await auth.client
                .from("threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", body.threadId);
            },
          });
          return result.toUIMessageStreamResponse({
            originalMessages: body.messages,
            headers: {
              "X-Aria-Usage-Used": String(usage.used),
              "X-Aria-Usage-Limit": String(usage.limit),
              "X-Aria-Usage-Reset": usage.resetAt,
            },
          });
        } catch (e) {
          await releaseUsage(auth.userId);
          console.error("Chat failed", e, lastError);
          const { logError } = await import("@/lib/admin.server");
          await logError({
            message: e instanceof Error ? e.message : "Chat request failed",
            detail: String((lastError as Error | undefined)?.stack ?? lastError ?? e),
            source: "chat",
            model: modelId,
            userId: auth.userId,
          });
          return new Response(
            "No provider available. Add an API key in Settings for the selected model.",
            { status: 502 },
          );
        }

      },
    },
  },
});
