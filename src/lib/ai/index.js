import gemini from "./providers/gemini.js";
import anthropic from "./providers/anthropic.js";
import openai from "./providers/openai.js";
import { buildSystemPrompt } from "./prompt.js";
import { REFUSAL } from "./errors.js";
import { logError, logWarn } from "../logger.js";

/**
 * Provider registry and failover chain.
 *
 * To add a provider: write `src/lib/ai/providers/<name>.js` implementing the
 * adapter contract (copy any existing one), then add one line below. Nothing
 * else changes — the prompt, sanitization, return shape and database columns
 * are all provider-independent.
 */
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
      // Constant message so every occurrence shares one fingerprint; the
      // varying provider name and cause go in the detail.
      logWarn(
        `ai.provider.${provider.name}`,
        "AI provider unavailable, trying next in chain",
        err?.cause?.message || err?.message
      );
    }
  }

  // Every provider failed. This is the state that holds user messages as
  // drafts, so it is worth an admin alert rather than a log line nobody reads.
  logError(
    "ai.chain",
    "every AI provider in the chain failed",
    `chain=${chain.map((p) => p.name).join(",")}`
  );

  return { rephrased: null, error: "ai_unavailable" };
}

/**
 * Practice Pad: AI plays the role of a conversation partner so the user can
 * rehearse what they want to say. The full conversation history is serialized
 * into a single user message (providers only expose `complete`, not multi-turn).
 */
export async function practiceChat(topic, turns) {
  const chain = resolveChain();
  if (chain.length === 0) {
    return { reply: null, error: "ai_unavailable" };
  }

  const system = [
    "You are a practice conversation partner in a safe relationship app called Leeway.",
    "The user wants to rehearse talking about a sensitive topic before sending a real message.",
    `Topic they want to practice: "${topic}"`,
    "",
    "Rules:",
    "- Play the role of their partner, responding naturally and honestly.",
    "- If they say something hurtful, gently point it out and suggest a kinder way.",
    "- Keep responses short (1-3 sentences) so the conversation feels natural.",
    "- Stay in character. Do NOT break the fourth wall or say you are an AI.",
    "- Be warm but realistic — do not always agree.",
  ].join("\n");

  const history = turns
    .map((t) => `${t.role === "user" ? "Them" : "You"}: ${t.content}`)
    .join("\n");

  const userMessage = history
    ? `Conversation so far:\n${history}\n\nRespond as the partner.`
    : "Start the conversation by asking what's on their mind about this topic.";

  for (const provider of chain) {
    try {
      const result = await provider.complete({
        system,
        userMessage,
        model: provider.defaultModel(),
        maxTokens: maxTokens(),
      });
      return {
        reply: result.text,
        tokensUsed: result.tokensUsed,
        model: result.model,
        provider: provider.name,
      };
    } catch (err) {
      if (err?.kind === REFUSAL) {
        return { reply: null, error: "content_refused", provider: provider.name };
      }
      logWarn(
        `ai.provider.${provider.name}`,
        "AI provider unavailable, trying next in chain",
        err?.cause?.message || err?.message
      );
    }
  }

  return { reply: null, error: "ai_unavailable" };
}

/**
 * AI Companion: generates a brief, supportive insight based on the user's
 * recent messaging patterns and Know Me entries.
 */
export async function generateInsight(context) {
  const chain = resolveChain();
  if (chain.length === 0) {
    return { insight: null, error: "ai_unavailable" };
  }

  const system = [
    "You are a gentle relationship coach in a safe communication app called Leeway.",
    "Based on the user's recent activity, generate ONE brief, supportive insight or tip.",
    "",
    "Rules:",
    "- Keep it to 1-2 sentences.",
    "- Be encouraging, never judgmental.",
    "- Reference specific patterns if provided (e.g. 'You've been great about discussing finances openly').",
    "- Suggest small, actionable steps when appropriate.",
    "- Never diagnose or give clinical advice.",
  ].join("\n");

  for (const provider of chain) {
    try {
      const result = await provider.complete({
        system,
        userMessage: context,
        model: provider.defaultModel(),
        maxTokens: 256,
      });
      return {
        insight: result.text,
        provider: provider.name,
      };
    } catch (err) {
      if (err?.kind === REFUSAL) {
        return { insight: null, error: "content_refused" };
      }
      logWarn(
        `ai.provider.${provider.name}`,
        "AI provider unavailable, trying next in chain",
        err?.cause?.message || err?.message
      );
    }
  }

  return { insight: null, error: "ai_unavailable" };
}

/**
 * AI-powered topic boundary analysis. Keyword matching catches literal
 * references; this catches indirect ones like "how much does it make" for money
 * or "are they still together" for family. Returns a structured verdict.
 */
export async function analyzeTopics(rawMessage, boundaryTopics) {
  if (!rawMessage?.trim() || !boundaryTopics?.length) {
    return { verdict: "clear", flaggedTopics: [] };
  }

  const chain = resolveChain();
  if (chain.length === 0) {
    return { verdict: "skip", flaggedTopics: [], error: "ai_unavailable" };
  }

  const topicList = boundaryTopics
    .map((t) => `- ${t.label} [${t.level}]`)
    .join("\n");

  const system = `You are a topic boundary analyzer for a safe communication app. The receiver has set these topic boundaries:

${topicList}

Levels: "red" = forbidden, "yellow" = handle gently.

Analyze the user's message and determine if it touches any of these topics — directly OR indirectly. Consider context, implications, and conversational intent, not just keywords.

Respond in EXACTLY this JSON format, nothing else:
{"flagged": [{"topic": "topic_label", "level": "red|yellow", "reason": "one short sentence"}], "clear": true|false}

If no boundaries are touched, respond: {"flagged": [], "clear": true}`;

  for (const provider of chain) {
    try {
      const result = await provider.complete({
        system,
        userMessage: rawMessage,
        model: provider.defaultModel(),
        maxTokens: 256,
      });

      const parsed = JSON.parse(result.text.replace(/```json\n?|```/g, "").trim());
      const flagged = Array.isArray(parsed.flagged) ? parsed.flagged : [];

      return {
        verdict: flagged.some((f) => f.level === "red") ? "blocked" : flagged.length > 0 ? "caution" : "clear",
        flaggedTopics: flagged,
        provider: provider.name,
      };
    } catch (err) {
      if (err?.kind === REFUSAL) {
        return { verdict: "skip", flaggedTopics: [], error: "content_refused" };
      }
      logWarn(
        `ai.provider.${provider.name}`,
        "AI topic analysis unavailable, trying next in chain",
        err?.cause?.message || err?.message
      );
    }
  }

  // AI unavailable — don't block the message, just skip AI analysis.
  return { verdict: "skip", flaggedTopics: [], error: "ai_unavailable" };
}

export { buildSystemPrompt };
