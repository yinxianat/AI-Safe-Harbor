import { ProviderError, INFRASTRUCTURE, REFUSAL, classifyHttp } from "../errors.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// Uses the REST endpoint rather than @anthropic-ai/sdk so that every provider
// in this directory has the same shape and the project carries no vendor SDK.
// We use one endpoint; a dependency would buy nothing and add lock-in.
const anthropicProvider = {
  name: "anthropic",

  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  defaultModel() {
    return process.env.AI_MODEL_ANTHROPIC || DEFAULT_MODEL;
  },

  /**
   * Model options an operator can pin for ad-hoc diagnostic calls.
   *
   * Not meant as an exhaustive catalog: these are the four we actively
   * support in the admin UI. The provider-level API accepts any model id
   * directly, so a one-off experiment can still pass a custom string —
   * this list is what the UI shows as the recommended choice.
   *
   * Comparing two models on the same question is how an operator tells
   * "the data is thin" from "this model is confused". Opus vs Haiku on
   * the same diagnostic is the most informative split: Haiku is cheap
   * and will show you what a fast surface answer looks like; Opus will
   * show you where the Haiku answer was wrong.
   */
  models() {
    return [
      { id: "claude-opus-4-7", label: "Opus 4.7", tier: "deep", notes: "Deepest reasoning. Use when the Haiku answer looks wrong or thin." },
      { id: "claude-sonnet-4-5", label: "Sonnet 4.5", tier: "balanced", notes: "The default. Good balance of depth and speed." },
      { id: "claude-haiku-4-5", label: "Haiku 4.5", tier: "fast", notes: "Fast and cheap. Good first pass for a sanity check." },
      { id: "claude-opus-5", label: "Opus 5", tier: "deep", notes: "Newest Opus; slower and costlier than 4.7. Use for the hardest questions." },
    ];
  },

  async complete({ system, userMessage, model, maxTokens }) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (err) {
      throw new ProviderError(INFRASTRUCTURE, "anthropic", err);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // A 400 can be a genuine content rejection, but only once we've ruled out
      // key/quota problems — those must fail over, not halt the chain.
      const kind = classifyHttp(response.status, body, { refusalOn400: true });
      throw new ProviderError(kind, "anthropic", new Error(`${response.status} ${body}`));
    }

    const data = await response.json().catch(() => null);

    if (data?.stop_reason === "refusal") {
      throw new ProviderError(REFUSAL, "anthropic", new Error("refusal"));
    }

    const text = data?.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (!text) {
      throw new ProviderError(INFRASTRUCTURE, "anthropic", new Error("empty response"));
    }

    return {
      text,
      model: data.model || model,
      tokensUsed:
        (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  },
};

export default anthropicProvider;
