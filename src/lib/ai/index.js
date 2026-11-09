import gemini from "./providers/gemini.js";
import anthropic from "./providers/anthropic.js";
import openai from "./providers/openai.js";
import { buildSystemPrompt } from "./prompt.js";
import { REFUSAL } from "./errors.js";

// ---------------------------------------------------------------------------
// To add a provider: write src/lib/ai/providers/<name>.js implementing the
// adapter contract (see any existing one), then add one line here. Nothing
// else in the codebase changes — the prompt, sanitization, return shape, and
// database columns are all provider-independent.
// ---------------------------------------------------------------------------
export const REGISTRY = {
  gemini,
  anthropic,
  openai,
};

// Gemini first: it has a usable free tier, so the default configuration costs
// nothing. Anthropic is the fallback when Gemini is unavailable.
const DEFAULT_CHAIN = ["gemini", "anthropic"];
const DEFAULT_MAX_TOKENS = 1024;

// Chain and models are env-driven, so switching providers never needs a code
// change or redeploy of new code:
//   AI_PROVIDER_CHAIN="gemini,anthropic"
//   AI_MODEL_GEMINI="gemini-2.5-flash"
export function resolveChain() {
  const configured = process.env.AI_PROVIDER_CHAIN;
  const names = configured
    ? configured.split(",").map((n) => n.trim()).filter(Boolean)
    : DEFAULT_CHAIN;

  const unknown = names.filter((n) => !REGISTRY[n]);
  if (unknown.length > 0) {
    console.error(
      `Unknown AI provider(s) in AI_PROVIDER_CHAIN: ${unknown.join(", ")}. ` +
        `Known providers: ${Object.keys(REGISTRY).join(", ")}`
    );
  }

  // A provider with no API key is skipped rather than erroring, so the chain
  // degrades to whatever is configured instead of failing outright.
  return names
    .map((name) => REGISTRY[name])
    .filter((provider) => provider && provider.isConfigured());
}

function maxTokens() {
  const parsed = parseInt(process.env.AI_MAX_TOKENS || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOKENS;
}

export async function rephraseMessage(rawMessage, receiverSettings) {
  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    return { rephrased: null, error: "empty_message" };
  }

  const chain = resolveChain();
  if (chain.length === 0) {
    return { rephrased: null, error: "ai_unavailable" };
  }

  const system = buildSystemPrompt(receiverSettings);

  for (const provider of chain) {
    try {
      const result = await provider.complete({
        system,
        userMessage: rawMessage,
        model: provider.defaultModel(),
        maxTokens: maxTokens(),
      });

      return {
        rephrased: result.text,
        tokensUsed: result.tokensUsed,
        model: result.model,
        provider: provider.name,
      };
    } catch (err) {
      // A refusal is a verdict on the content itself. Asking the next provider
      // is shopping for a more agreeable answer, and the product requires
      // surfacing the refusal instead.
      if (err?.kind === REFUSAL) {
        return {
          rephrased: null,
          error: "content_refused",
          provider: provider.name,
        };
      }
      console.error(
        `AI provider ${provider.name} unavailable:`,
        err?.cause?.message || err?.message
      );
    }
  }

  return { rephrased: null, error: "ai_unavailable" };
}

export { buildSystemPrompt };
