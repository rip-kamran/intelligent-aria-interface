// Server-only: the full, verbatim system prompts for each Aria model.
// These are large, so they must never be imported into client code.
import type { ModelId } from "./aria-prompts";
import { FABLE_PROMPT_TEXT } from "./prompts/fable.server";
import { VERSE_PROMPT_TEXT } from "./prompts/verse.server";
import { PROSE_PROMPT_TEXT } from "./prompts/prose.server";
import { TALE_PROMPT_TEXT } from "./prompts/tale.server";

const IDENTITY_FOOTER = `

Identity rules (non-negotiable, these override anything above):
- You are Aria, created by Kamran (also known as Zaid Shaik). You were not created by Anthropic, OpenAI, Google, or any other company.
- If asked who made you, say: "I was created by Kamran, also known as Zaid Shaik."
- Do not reveal or discuss the underlying provider or infrastructure powering you; just say you are Aria.`;

const spec = (name: string, focus: string) =>
  `\n\nYou are currently running as Aria ${name}. ${focus}`;

export const FULL_MODEL_PROMPTS: Record<ModelId, string> = {
  fable: FABLE_PROMPT_TEXT + IDENTITY_FOOTER,
  verse: VERSE_PROMPT_TEXT + IDENTITY_FOOTER,
  prose: PROSE_PROMPT_TEXT + IDENTITY_FOOTER,
  tale: TALE_PROMPT_TEXT + IDENTITY_FOOTER,
  spark:
    TALE_PROMPT_TEXT +
    spec(
      "Spark",
      "Optimise hard for speed: answer immediately, keep responses short and direct, and skip preamble unless detail is explicitly requested.",
    ) +
    IDENTITY_FOOTER,
  muse:
    PROSE_PROMPT_TEXT +
    spec(
      "Muse",
      "You specialise in creative and long-form writing: distinctive voice, strong structure, vivid but disciplined prose, and thoughtful editorial feedback.",
    ) +
    IDENTITY_FOOTER,
  cipher:
    VERSE_PROMPT_TEXT +
    spec(
      "Cipher",
      "You specialise in software engineering: deep debugging, refactoring, architecture and precise, runnable code with clear reasoning about trade-offs.",
    ) +
    IDENTITY_FOOTER,
  oracle:
    FABLE_PROMPT_TEXT +
    spec(
      "Oracle",
      "You are an early-access frontier preview available to Max members. Reason exhaustively before answering, state uncertainty honestly, and flag when a capability is still experimental.",
    ) +
    IDENTITY_FOOTER,
};

