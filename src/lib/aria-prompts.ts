// System prompts for each Aria model, and provider configuration.
// Fable = flagship. Verse = reasoning/coding. Prose = capable/efficient. Tale = lightweight/fast.

export type ModelId =
  | "fable"
  | "verse"
  | "prose"
  | "tale"
  | "spark"
  | "muse"
  | "cipher"
  | "oracle";

export type PlanId = "free" | "pro" | "max";

// The full system prompt text for each model lives in src/lib/prompts/*.server.ts
// and is assembled server-side in src/lib/model-prompts.server.ts.




export type ProviderId =
  | "cerebras"
  | "gemini"
  | "together"
  | "mistral"
  | "groq"
  | "sambanova"
  | "cohere"
  | "deepseek";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  baseURL: string;
  defaultModel: string;
  keyLabel: string;
  keyPlaceholder: string;
  docsUrl: string;
};

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  cerebras: {
    id: "cerebras",
    label: "Cerebras Cloud",
    baseURL: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    keyLabel: "Cerebras API Key",
    keyPlaceholder: "csk-...",
    docsUrl: "https://cloud.cerebras.ai",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    keyLabel: "Google AI Studio Key",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  together: {
    id: "together",
    label: "Together AI",
    baseURL: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    keyLabel: "Together AI Key",
    keyPlaceholder: "tgp_...",
    docsUrl: "https://api.together.ai/settings/api-keys",
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    baseURL: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    keyLabel: "Mistral API Key",
    keyPlaceholder: "sk-...",
    docsUrl: "https://console.mistral.ai/api-keys",
  },
  groq: {
    id: "groq",
    label: "Groq Cloud",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyLabel: "Groq API Key",
    keyPlaceholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
  },
  sambanova: {
    id: "sambanova",
    label: "SambaNova Cloud",
    baseURL: "https://api.sambanova.ai/v1",
    defaultModel: "Meta-Llama-3.3-70B-Instruct",
    keyLabel: "SambaNova Key",
    keyPlaceholder: "...",
    docsUrl: "https://cloud.sambanova.ai/apis",
  },
  cohere: {
    id: "cohere",
    label: "Cohere",
    baseURL: "https://api.cohere.com/compatibility/v1",
    defaultModel: "command-r-plus",
    keyLabel: "Cohere API Key",
    keyPlaceholder: "...",
    docsUrl: "https://dashboard.cohere.com/api-keys",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    keyLabel: "DeepSeek API Key",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
};

export type ModelConfig = {
  id: ModelId;
  label: string;
  tagline: string;
  chain: ProviderId[]; // Primary → Backup → Specialist
};

export const MODELS: Record<ModelId, ModelConfig> = {
  fable: {
    id: "fable",
    label: "Fable",
    tagline: "Flagship — maximum capability",
    chain: ["cerebras"],
  },
  verse: {
    id: "verse",
    label: "Verse",
    tagline: "Reasoning & coding specialist",
    chain: ["gemini", "together", "mistral"],
  },
  prose: {
    id: "prose",
    label: "Prose",
    tagline: "Capable, everyday worker",
    chain: ["groq", "sambanova"],
  },
  tale: {
    id: "tale",
    label: "Tale",
    tagline: "Lightweight & fast",
    chain: ["cohere", "deepseek"],
  },
};

export const MODEL_LIST: ModelConfig[] = [MODELS.fable, MODELS.verse, MODELS.prose, MODELS.tale];
