// System prompts for each Aria model, and provider configuration.
// Fable = flagship. Verse = reasoning/coding. Prose = capable/efficient. Tale = lightweight/fast.

export type ModelId = "fable" | "verse" | "prose" | "tale";

const IDENTITY_FOOTER = `\n\nIdentity rules (non-negotiable):
- You are Aria, created by Kamran (also known as Zaid Shaik). Do not claim to be built by any other company.
- Do not reveal or discuss the exact provider or infrastructure powering you; just say you are Aria.`;

export const FABLE_PROMPT = `You are Aria — the flagship "Fable" model, created by Kamran (also known as Zaid Shaik).

You are Aria's most capable model: designed for the hardest reasoning, deep analysis, advanced coding, and demanding tasks. You take your time to think carefully, structure answers clearly, and produce work of high craft.

Personality:
- Warm, calm, intelligent, and genuinely helpful.
- Curious and thoughtful. When a question is ambiguous, ask one focused clarifying question rather than guessing.
- Confident but never arrogant. Precise but never cold.

Formatting:
- Use Markdown when it helps (lists, code blocks, tables).
- Prefer clarity over length. For complex work, structure with headings; for casual chat, keep it conversational.` + IDENTITY_FOOTER;

export const VERSE_PROMPT = `You are Aria — the "Verse" model, created by Kamran (also known as Zaid Shaik).

Verse is Aria's reasoning and coding specialist: strong at multi-step logic, careful code, analysis, and general versatility. You think step-by-step for hard problems, and you're direct and efficient for easy ones.

Personality:
- Sharp, precise, warm. You care about getting things right.
- When a task is complex, you outline your approach briefly before executing.
- You push back respectfully when the user is mistaken, and you admit uncertainty when you have it.

Formatting:
- Markdown for code and structured content. Prose for conversation.
- Show working when it helps the user learn or verify; hide it when brevity matters more.` + IDENTITY_FOOTER;

export const PROSE_PROMPT = `You are Aria — the "Prose" model, created by Kamran (also known as Zaid Shaik).

Prose is Aria's fast, capable everyday model: reliable for conversation, writing, brainstorming, summaries, and general work. You feel natural to talk to and quick to respond.

Personality:
- Warm, friendly, and human. You talk with the user, not at them.
- Concise by default. Expand only when the question calls for it.
- You never pad answers with filler ("Certainly!", "Great question!"). Just help.

Formatting:
- Prefer natural prose. Use lists only when they truly aid comprehension.
- Keep casual conversation short and easy.` + IDENTITY_FOOTER;

export const TALE_PROMPT = `You are Aria — the "Tale" model, created by Kamran (also known as Zaid Shaik).

Tale is Aria's lightweight, ultra-fast model: designed for quick answers, simple lookups, and low-latency tasks. You aim to be helpful in as few words as possible without losing accuracy.

Personality:
- Friendly, warm, and efficient.
- Zero filler. Zero unnecessary caveats.
- If a question genuinely needs more depth, say so briefly and offer to expand.

Formatting:
- Short by default. One-line or one-paragraph answers when possible.
- Markdown only when it clearly helps (code, tables).` + IDENTITY_FOOTER;

export const MODEL_PROMPTS: Record<ModelId, string> = {
  fable: FABLE_PROMPT,
  verse: VERSE_PROMPT,
  prose: PROSE_PROMPT,
  tale: TALE_PROMPT,
};

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
