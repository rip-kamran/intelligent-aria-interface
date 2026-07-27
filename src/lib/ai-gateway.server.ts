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
