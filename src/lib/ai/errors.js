/**
 * Provider failures come in two kinds, with opposite handling:
 *
 *   "infrastructure" — timeout, rate limit, 5xx, auth, network. The request was
 *     never fairly judged, so another provider may succeed. Do fail over.
 *
 *   "refusal" — the provider evaluated the content and declined. A second
 *     provider will very likely decline too, and the product requires showing
 *     the refusal rather than shopping for a yes. Do not fail over.
 *
 * Classification belongs in each adapter, because only the adapter understands
 * its own error shape. The chain reads nothing but `kind`.
 */
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

// "Misconfigured or out of capacity" — always infrastructure, whatever status
// carries it, because a broken key on provider 1 must not stop us trying
// provider 2. Gemini reports an invalid key as HTTP 400 / API_KEY_INVALID, not
// 401, so treating every 400 as a refusal let one typo'd key hold every
// message as a draft with the fallback never reached.
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
