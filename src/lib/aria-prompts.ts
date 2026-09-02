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

/**
 * Effort / efficiency modes. Higher effort lets Aria think longer, use more
 * tool steps and write more, and costs more of the message allowance.
 */
export type EfficiencyId = "low" | "mid" | "max";

export type EfficiencyConfig = {
  id: EfficiencyId;
  label: string;
  blurb: string;
  /** Max tool/reasoning steps per reply. */
  maxSteps: number;
  /** Max output tokens per reply. */
  maxOutputTokens: number;
  temperature: number;
  /** How many messages this reply deducts from the allowance. */
  cost: number;
  /** Extra guidance appended to the system prompt. */
  hint: string;
};

export const EFFICIENCY_LEVELS: Record<EfficiencyId, EfficiencyConfig> = {
  low: {
    id: "low",
    label: "Low",
    blurb: "Fastest. Short, direct answers, minimal browsing.",
    maxSteps: 3,
    maxOutputTokens: 800,
    temperature: 0.5,
    cost: 1,
    hint: "Optimise for speed. Answer directly and briefly, skip preamble, and only use tools when the answer is impossible without them.",
  },
  mid: {
    id: "mid",
    label: "Mid",
    blurb: "Balanced speed, depth and tool use. Recommended.",
    maxSteps: 6,
    maxOutputTokens: 2000,
    temperature: 0.7,
    cost: 1,
    hint: "Balance speed and depth. Use tools when they clearly improve accuracy.",
  },
  max: {
    id: "max",
    label: "Max",
    blurb: "Deepest reasoning, more research steps, longer answers. Uses more of your allowance.",
    maxSteps: 12,
    maxOutputTokens: 6000,
    temperature: 0.8,
    cost: 3,
    hint: "Maximise quality. Reason carefully step by step, verify facts with search when useful, and give thorough, well-structured answers with examples.",
  },
};

export const EFFICIENCY_LIST: EfficiencyConfig[] = [
  EFFICIENCY_LEVELS.low,
  EFFICIENCY_LEVELS.mid,
  EFFICIENCY_LEVELS.max,
];

export const EFFICIENCY_IDS = ["low", "mid", "max"] as const;

export function resolveEfficiency(value: string | null | undefined): EfficiencyConfig {
  return EFFICIENCY_LEVELS[(value as EfficiencyId) ?? "mid"] ?? EFFICIENCY_LEVELS.mid;
}

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
  /** Minimum plan required to use this model. */
  tier: PlanId;
  /** Max-only early-access / experimental models. */
  earlyAccess?: boolean;
};

export const MODELS: Record<ModelId, ModelConfig> = {
  tale: {
    id: "tale",
    label: "Tale",
    tagline: "Lightweight & fast",
    chain: ["cohere", "deepseek"],
    tier: "free",
  },
  prose: {
    id: "prose",
    label: "Prose",
    tagline: "Capable, everyday worker",
    chain: ["groq", "sambanova"],
    tier: "free",
  },
  spark: {
    id: "spark",
    label: "Spark",
    tagline: "Instant answers, minimal latency",
    chain: ["groq", "cerebras"],
    tier: "free",
  },
  verse: {
    id: "verse",
    label: "Verse",
    tagline: "Reasoning & coding specialist",
    chain: ["gemini", "together", "mistral"],
    tier: "pro",
  },
  muse: {
    id: "muse",
    label: "Muse",
    tagline: "Creative writing & long-form voice",
    chain: ["mistral", "together", "cohere"],
    tier: "pro",
  },
  cipher: {
    id: "cipher",
    label: "Cipher",
    tagline: "Deep code, refactors & debugging",
    chain: ["deepseek", "together", "gemini"],
    tier: "pro",
  },
  fable: {
    id: "fable",
    label: "Fable",
    tagline: "Flagship — maximum capability",
    chain: ["cerebras"],
    tier: "pro",
  },
  oracle: {
    id: "oracle",
    label: "Oracle",
    tagline: "Frontier research preview",
    chain: ["cerebras", "gemini"],
    tier: "max",
    earlyAccess: true,
  },
};

export const MODEL_LIST: ModelConfig[] = [
  MODELS.tale,
  MODELS.prose,
  MODELS.spark,
  MODELS.verse,
  MODELS.muse,
  MODELS.cipher,
  MODELS.fable,
  MODELS.oracle,
];

export const MODEL_IDS = MODEL_LIST.map((m) => m.id) as [ModelId, ...ModelId[]];

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, max: 2 };

export function canUseModel(plan: PlanId, model: ModelId) {
  return PLAN_RANK[plan] >= PLAN_RANK[MODELS[model].tier];
}

export type PlanConfig = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  dailyMessages: number;
  blurb: string;
  features: string[];
  highlight?: boolean;
};

export const FREE_DAILY_LIMIT = 30;
export const PRO_DAILY_LIMIT = 750;
export const MAX_DAILY_LIMIT = PRO_DAILY_LIMIT * 20;

export const DAILY_LIMITS: Record<PlanId, number> = {
  free: FREE_DAILY_LIMIT,
  pro: PRO_DAILY_LIMIT,
  max: MAX_DAILY_LIMIT,
};

/** Usage allowance resets this many hours after the window started. */
export const USAGE_WINDOW_HOURS = 12;
/** Sentinel key for the single rolling-window usage row per user. */
export const USAGE_ROW_KEY = "1970-01-01";
/** Warn the user once they cross this fraction of their allowance. */
export const USAGE_WARN_AT = 0.9;


export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: "£0",
    period: "forever",
    dailyMessages: FREE_DAILY_LIMIT,
    blurb: "Everything you need to get to know Aria.",
    features: [
      `${FREE_DAILY_LIMIT} messages per day`,
      "Aria Tale, Prose & Spark",
      "Unlimited chat threads, search & export",
      "Personalisation and custom instructions",
      "Bring your own API keys",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "£15",
    period: "per month",
    dailyMessages: PRO_DAILY_LIMIT,
    blurb: "The full Aria line-up, including Verse and Fable.",
    highlight: true,
    features: [
      `${PRO_DAILY_LIMIT} messages per day`,
      "Unlocks Aria Verse & Fable",
      "Plus Muse (creative) and Cipher (code)",
      "Priority provider routing & longer context",
      "Faster response speeds at peak times",
    ],
  },
  max: {
    id: "max",
    name: "Max",
    price: "£90–£150",
    period: "per month",
    dailyMessages: MAX_DAILY_LIMIT,
    blurb: "For people who live inside Aria all day.",
    features: [
      `20× Pro's usage — ${MAX_DAILY_LIMIT.toLocaleString()} messages per day`,
      "Early access to every new Aria model",
      "Aria Oracle frontier research preview",
      "Highest priority queue, even under load",
      "Extended memory and larger uploads",
      "Direct support from Kamran (Zaid Shaik)",
    ],
  },
};

export const PLAN_LIST: PlanConfig[] = [PLANS.free, PLANS.pro, PLANS.max];


/**
 * Payments are not live yet, so plans are a preview: nobody can buy an upgrade.
 * Any non-free plan on a profile was therefore granted by an admin (a gift or
 * early access), and those grants ARE honoured. Flip this to true once a
 * payment provider is connected.
 */
export const PAYMENTS_ENABLED = false;

/** The plan that is actually enforced right now. */
export function effectivePlan(plan: PlanId): PlanId {
  return resolvePlan(plan);
}

/**
 * Resolves the plan a user is actually on, expiring admin-granted upgrades
 * once their end date has passed.
 */
export function resolvePlan(
  plan: PlanId | null | undefined,
  planExpiresAt?: string | null,
): PlanId {
  const stored = (plan ?? "free") as PlanId;
  if (stored === "free") return "free";
  if (planExpiresAt && new Date(planExpiresAt).getTime() <= Date.now()) return "free";
  return stored;
}

/** The message allowance for a user, honouring an admin-set override. */
export function resolveLimit(plan: PlanId, override?: number | null): number {
  if (typeof override === "number" && override >= 0) return override;
  return DAILY_LIMITS[plan];
}

/* ------------------------------------------------------------------ */
/* Credits                                                             */
/* ------------------------------------------------------------------ */

/** Credit packs users will be able to buy once payments go live. */
export type CreditPack = {
  id: string;
  credits: number;
  price: string;
  blurb: string;
  highlight?: boolean;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", credits: 100, price: "£10", blurb: "A taste of Pro." },
  { id: "plus", credits: 550, price: "£50", blurb: "Best value — 10% bonus credits.", highlight: true },
  { id: "power", credits: 1200, price: "£100", blurb: "20% bonus credits for heavy users." },
];

/** What 30 days of each plan costs in credits. */
export const PLAN_CREDIT_COST: Record<Exclude<PlanId, "free">, number> = {
  pro: 150,
  max: 900,
};

/** Days of access granted per redemption. */
export const PLAN_REDEEM_DAYS = 30;

/** Credit purchases aren't live yet — same reason as PAYMENTS_ENABLED. */
export const CREDIT_PURCHASE_ENABLED = false;
