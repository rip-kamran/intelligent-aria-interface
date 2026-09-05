import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Aria's default voice (warm, natural). */
const DEFAULT_VOICE = "alloy";
const ALLOWED_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"]);
const MAX_CHARS = 4000;

async function verifyUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  if (token.split(".").length !== 3) return null;

  const url = process.env["SUPABASE_URL"]!;
  const anon = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient<Database>(url, anon, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", anon);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("Voice mode isn't configured yet.", { status: 503 });
        }

        let body: { text?: string; voice?: string };
        try {
          body = (await request.json()) as { text?: string; voice?: string };
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }
        const text = (body.text ?? "").trim().slice(0, MAX_CHARS);
        if (!text) return new Response("Nothing to speak", { status: 400 });
        const voice = ALLOWED_VOICES.has(body.voice ?? "") ? body.voice! : DEFAULT_VOICE;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice,
            response_format: "mp3",
            instructions:
              "You are Aria, a warm, calm and intelligent assistant. Speak naturally and conversationally, with a friendly, unhurried tone.",
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          if (res.status === 429) {
            return new Response("Voice is busy right now — try again in a moment.", { status: 429 });
          }
          if (res.status === 402) {
            return new Response("Voice credits have run out.", { status: 402 });
          }
          console.error("[tts] gateway error", res.status, detail.slice(0, 300));
          return new Response("Voice generation failed.", { status: res.status || 502 });
        }

        return new Response(res.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
