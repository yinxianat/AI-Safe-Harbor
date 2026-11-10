// Logs outlive requests and get read by people. Nothing identifying or
// credential-shaped may be persisted, even accidentally, so everything written
// to a log passes through here first.

const PATTERNS = [
  // Connection strings, with or without credentials
  [/\b[a-z+]+:\/\/[^\s"']*@[^\s"']+/gi, "[connection-string]"],
  // Bearer tokens and API keys of the common shapes
  [/\b(sk-ant-|sk-|AIza|ghp_|gho_)[A-Za-z0-9_-]{8,}/g, "[api-key]"],
  [/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [redacted]"],
  // JWTs
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, "[jwt]"],
  // Long hex strings — our magic-link tokens are 64 hex chars
  [/\b[a-f0-9]{32,}\b/gi, "[token]"],
];

// alice@example.com -> a***@example.com
// The domain is kept because it is useful when debugging delivery, while the
// local part is what identifies a person.
export function maskEmail(value) {
  return String(value).replace(
    /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    (_, first, domain) => `${first}***@${domain}`
  );
}

export function redact(value) {
  if (value === null || value === undefined) return null;

  let out = typeof value === "string" ? value : safeStringify(value);
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return maskEmail(out).slice(0, 2000);
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
