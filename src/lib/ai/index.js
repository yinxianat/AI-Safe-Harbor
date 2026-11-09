import anthropic from "./providers/anthropic.js";
import openai from "./providers/openai.js";
import { buildSystemPrompt } from "./prompt.js";
import { REFUSAL } from "./errors.js";

const REGISTRY = { anthropic, openai };

const DEFAULT_CHAIN = ["anthropic", "openai"];
const DEFAULT_MAX_TOKENS = 1024;

// Chain and models come from env, so switching providers needs no code change:
//   AI_PROVIDER_CHAIN="openai,anthropic"
//   AI_MODEL_ANTHROPIC="claude-sonnet-4-5"
//   AI_MODEL_OPENAI="gpt-4o"
function resolveChain() {
  const configured = process.env.AI_PROVIDER_CHAIN;
  const names = configured
    ? configured.split(",").map((n) => n.trim()).filter(Boolean)
    : DEFAULT_CHAIN;

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
      // A refusal is a verdict on the content — surface it rather than asking
      // a different provider for a more agreeable answer.
      if (err?.kind === REFUSAL) {
        return {
          rephrased: null,
          error: "content_refused",
          provider: provider.name,
        };
      }
      // Infrastructure failure: try the next provider in the chain.
      console.error(`AI provider ${provider.name} unavailable:`, err?.cause?.message || err?.message);
    }
  }

  return { rephrased: null, error: "ai_unavailable" };
}

export { buildSystemPrompt };
