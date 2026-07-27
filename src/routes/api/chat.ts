import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MODEL_PROMPTS, MODELS, type ModelId } from "@/lib/aria-prompts";
import { createProviderModel, createLovableFallbackModel } from "@/lib/ai-gateway.server";

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

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const auth = await verifyAndGetSupabase(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        // Load profile + keys (as user, RLS applies)
        const [{ data: profile }, { data: keyRows }] = await Promise.all([
          auth.client
            .from("profiles")
            .select("preferred_model, custom_instructions, display_name")
            .eq("id", auth.userId)
            .maybeSingle(),
          auth.client.from("user_api_keys").select("provider, api_key"),
        ]);
        const keys: Record<string, string> = {};
        for (const r of keyRows ?? []) keys[r.provider as string] = r.api_key as string;

        const modelId: ModelId =
          body.model || (profile?.preferred_model as ModelId) || "verse";
        const chain = MODELS[modelId].chain;

        // Build system prompt with custom instructions
        let system = MODEL_PROMPTS[modelId];
        if (profile?.display_name) {
          system += `\n\nThe user's name is ${profile.display_name}.`;
        }
        if (profile?.custom_instructions?.trim()) {
          system += `\n\n<user_preferences>\n${profile.custom_instructions.trim()}\n</user_preferences>`;
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
            parts: userMsg.parts,
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

        // No user key worked — fallback to Lovable AI (free tier).
        try {
          const model = createLovableFallbackModel();
          const result = streamText({
            model,
            system,
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
          console.error("Chat failed", e, lastError);
          return new Response(
            "No provider available. Add an API key in Settings for the selected model.",
            { status: 502 },
          );
        }
      },
    },
  },
});
