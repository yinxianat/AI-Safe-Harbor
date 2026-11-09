import { ProviderError, INFRASTRUCTURE, REFUSAL } from "../errors.js";

const DEFAULT_MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const geminiProvider = {
  name: "gemini",

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
  },

  defaultModel() {
    return process.env.AI_MODEL_GEMINI || DEFAULT_MODEL;
  },

  async complete({ system, userMessage, model, maxTokens }) {
    let response;
    try {
      response = await fetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Key goes in a header, never the URL — query strings end up in
          // proxy logs, access logs, and error reporters.
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      });
    } catch (err) {
      throw new ProviderError(INFRASTRUCTURE, "gemini", err);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const kind = response.status === 400 ? REFUSAL : INFRASTRUCTURE;
      throw new ProviderError(kind, "gemini", new Error(`${response.status} ${body}`));
    }

    const data = await response.json().catch(() => null);

    // Gemini reports a safety block either on the prompt or on the candidate,
    // with a 200 status in both cases.
    if (data?.promptFeedback?.blockReason) {
      throw new ProviderError(
        REFUSAL,
        "gemini",
        new Error(`prompt blocked: ${data.promptFeedback.blockReason}`)
      );
    }

    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
      throw new ProviderError(REFUSAL, "gemini", new Error(candidate.finishReason));
    }

    const text = candidate?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("");

    if (!text) {
      throw new ProviderError(INFRASTRUCTURE, "gemini", new Error("empty response"));
    }

    return {
      text,
      model: data.modelVersion || model,
      tokensUsed: data.usageMetadata?.totalTokenCount || 0,
    };
  },
};

export default geminiProvider;
