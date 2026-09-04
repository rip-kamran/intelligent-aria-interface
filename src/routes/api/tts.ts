import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Aria's default ElevenLabs voice (Sarah — warm, natural). */
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";
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

        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) {
          return new Response("Voice mode isn't configured yet.", { status: 503 });
        }

        let body: { text?: string; voiceId?: string };
        try {
          body = (await request.json()) as { text?: string; voiceId?: string };
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }
        const text = (body.text ?? "").trim().slice(0, MAX_CHARS);
        if (!text) return new Response("Nothing to speak", { status: 400 });
        const voiceId = /^[A-Za-z0-9]{10,40}$/.test(body.voiceId ?? "")
          ? body.voiceId!
          : DEFAULT_VOICE;

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              model_id: "eleven_turbo_v2_5",
              voice_settings: {
                stability: 0.45,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true,
              },
            }),
          },
        );

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          return new Response(detail || "Voice generation failed.", { status: res.status || 502 });
        }

        return new Response(res.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
