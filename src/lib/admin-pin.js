import { createHmac, timingSafeEqual } from "crypto";

/**
 * Bootstrap sign-in for an admin when email delivery is broken.
 *
 * Exists because the normal admin flow is email-based, so a mail outage locks
 * the operator out of the very dashboard that would tell them *why* mail is
 * out. The PIN is an emergency ignition, not a second permanent credential —
 * disabled by default, owned by one person, and only valid for an address that
 * is already on ADMIN_EMAILS, so it cannot promote anyone new.
 *
 * Trade-off against B8's rule ("admin is a role, not a password"): that rule
 * applies to the steady state, which this module does not change. The PIN
 * cannot grant admin — it can only re-authenticate an existing admin — and the
 * `ADMIN_PIN` env must be unset once email is working again.
 */

const MIN_PIN_LENGTH = 6;

export function pinConfigured() {
  const value = process.env.ADMIN_PIN;
  return typeof value === "string" && value.length >= MIN_PIN_LENGTH;
}

// HMAC both sides so timingSafeEqual sees fixed-length buffers: comparing the
// PINs directly would leak their length through the wrong-length early return.
export function verifyPin(submitted) {
  if (!pinConfigured()) return false;
  if (typeof submitted !== "string" || submitted.length === 0) return false;

  const expected = process.env.ADMIN_PIN;
  // JWT_SECRET is already required for auth to work, so no new secret to carry.
  const secret = process.env.JWT_SECRET || "";
  const a = createHmac("sha256", secret).update(submitted).digest();
  const b = createHmac("sha256", secret).update(expected).digest();
  return timingSafeEqual(a, b);
}

// A single-container in-memory limiter. Enough for this app — if we ever run
// more than one container, swap for a database-backed counter. The window is
// deliberately long and the ceiling deliberately low, because a legitimate
// operator typing their own PIN does not need five tries in 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map();

function prune(ip, now) {
  const past = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (past.length === 0) attempts.delete(ip);
  else attempts.set(ip, past);
  return past;
}

export function checkRateLimit(ip) {
  const now = Date.now();
  const past = prune(ip, now);
  if (past.length >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - past[0])) / 1000) };
  }
  return { ok: true };
}

export function recordAttempt(ip) {
  const now = Date.now();
  const past = prune(ip, now);
  attempts.set(ip, [...past, now]);
}

export function clearAttempts(ip) {
  attempts.delete(ip);
}

// Test seam. Not called in production.
export function __resetAttemptsForTest() {
  attempts.clear();
}
