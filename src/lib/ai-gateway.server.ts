import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { PROVIDERS, type ProviderId } from "./aria-prompts";

export function createProviderModel(
  provider: ProviderId,
  apiKey: string,
  modelId?: string,
): LanguageModel {
  const cfg = PROVIDERS[provider];
  const client = createOpenAICompatible({
    name: provider,
    baseURL: cfg.baseURL,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return client(modelId || cfg.defaultModel);
}

/**
 * Project-level Ollama Cloud keys (owner-funded pool). Rotation spreads load
 * across the 5 keys; a simple counter is enough — no state needed across
 * requests since each key has its own quota on Ollama's side.
 */
let ollamaCursor = 0;

export function getOllamaKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`OLLAMA_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

/** Next key in round-robin order, or null when none are configured. */
export function nextOllamaKey(): string | null {
  const keys = getOllamaKeys();
  if (keys.length === 0) return null;
  const key = keys[ollamaCursor % keys.length];
  ollamaCursor = (ollamaCursor + 1) % keys.length;
  return key;
}

export function createOllamaModel(apiKey: string, modelId?: string): LanguageModel {
  return createProviderModel("ollama", apiKey, modelId);
}

// Fallback to Lovable AI when the user has no keys configured.
export function createLovableFallbackModel(): LanguageModel {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("No API keys configured");
  const client = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": key },
  });
  return client("google/gemini-3.6-flash");
}
