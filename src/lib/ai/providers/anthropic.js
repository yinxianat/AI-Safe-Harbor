import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, INFRASTRUCTURE, REFUSAL } from "../errors.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";

let client;
function getClient() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

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
      response = await getClient().messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      });
    } catch (err) {
      // A 400 means the request itself was rejected on its merits; everything
      // else (429, 5xx, 401, network) is infrastructure and worth failing over.
      const kind =
        err?.status === 400 || err?.error?.type === "invalid_request_error"
          ? REFUSAL
          : INFRASTRUCTURE;
      throw new ProviderError(kind, "anthropic", err);
    }

    const text = response.content?.find((b) => b.type === "text")?.text;
    if (!text) {
      throw new ProviderError(INFRASTRUCTURE, "anthropic", new Error("empty response"));
    }

    return {
      text,
      model: response.model,
      tokensUsed:
        (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    };
  },
};

export default anthropicProvider;
