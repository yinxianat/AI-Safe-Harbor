// Two kinds of failure, with opposite handling:
//
//   "infrastructure" — timeout, rate limit, 5xx, auth, network. The request was
//     never fairly judged, so another provider may succeed. DO fail over.
//
//   "refusal" — the provider evaluated the content and declined. A second
//     provider will very likely decline too, and the product requires showing
//     the refusal rather than shopping for a yes. Do NOT fail over.
//
// Classification belongs in each adapter, because only the adapter understands
// its own SDK's error shape. The chain reads nothing but `kind`.
export class ProviderError extends Error {
  constructor(kind, provider, cause) {
    super(`${provider}: ${kind}`);
    this.name = "ProviderError";
    this.kind = kind;
    this.provider = provider;
    this.cause = cause;
  }
}

export const INFRASTRUCTURE = "infrastructure";
export const REFUSAL = "refusal";

// Markers that mean "this provider is misconfigured or out of capacity".
// These are ALWAYS infrastructure, whatever HTTP status carries them, because a
// broken key on provider 1 must never stop us trying provider 2.
//
// This matters more than it looks: Gemini reports an invalid API key as
// HTTP 400 / API_KEY_INVALID, not 401. Classifying every 400 as a refusal
// meant a single typo'd key silently held every message as a draft and the
// fallback provider was never reached.
const CONFIG_OR_CAPACITY = /api[\s_-]?key|unauthenticated|unauthorized|permission[\s_-]?denied|forbidden|quota|billing|rate[\s_-]?limit|exceeded|insufficient|expired|credential|invalid[\s_-]?argument/i;

/**
 * @param {number} status      HTTP status returned by the provider
 * @param {string} body        raw response body (may be empty)
 * @param {object} opts
 * @param {boolean} opts.refusalOn400
 *   Whether a 400 from THIS provider can mean "content declined on its merits".
 *   False for providers that signal content blocks with a 2xx instead.
 */
export function classifyHttp(status, body = "", { refusalOn400 = true } = {}) {
  if (CONFIG_OR_CAPACITY.test(body)) return INFRASTRUCTURE;
  if (status === 401 || status === 403 || status === 429 || status >= 500) {
    return INFRASTRUCTURE;
  }
  if (status === 400 && refusalOn400) return REFUSAL;
  return INFRASTRUCTURE;
}
