import { ProviderError, INFRASTRUCTURE, REFUSAL } from "../errors.js";

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
      // 400 means the request was rejected on its merits; 401/429/5xx are
      // infrastructure and worth failing over to the next provider.
      const kind = response.status === 400 ? REFUSAL : INFRASTRUCTURE;
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
