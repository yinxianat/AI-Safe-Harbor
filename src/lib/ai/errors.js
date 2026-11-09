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
