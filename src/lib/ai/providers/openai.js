import { ProviderError, INFRASTRUCTURE, REFUSAL, classifyHttp } from "../errors.js";

// Implemented against the REST endpoint with `fetch` rather than the `openai`
// SDK, so adding a fallback provider costs no extra dependency.
const DEFAULT_MODEL = "gpt-4o";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

const openaiProvider = {
  name: "openai",

  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  defaultModel() {
    return process.env.AI_MODEL_OPENAI || DEFAULT_MODEL;
  },

  async complete({ system, userMessage, model, maxTokens }) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMessage },
          ],
        }),
      });
    } catch (err) {
      throw new ProviderError(INFRASTRUCTURE, "openai", err);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const kind = classifyHttp(response.status, body, { refusalOn400: true });
      throw new ProviderError(kind, "openai", new Error(`${response.status} ${body}`));
    }

    const data = await response.json().catch(() => null);
    const choice = data?.choices?.[0];

    // OpenAI signals a content-policy stop via finish_reason rather than a 4xx.
    if (choice?.finish_reason === "content_filter") {
      throw new ProviderError(REFUSAL, "openai", new Error("content_filter"));
    }

    const text = choice?.message?.content;
    if (!text) {
      throw new ProviderError(INFRASTRUCTURE, "openai", new Error("empty response"));
    }

    return {
      text,
      model: data.model || model,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  },
};

export default openaiProvider;
