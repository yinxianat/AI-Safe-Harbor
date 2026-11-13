import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// scrypt cost — chosen to take ~100ms on a modern server, which is slow
// enough to deter guessing but fast enough for interactive login.
const DEFAULT_N = 2 ** 15;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

export function validatePasswordShape(password) {
  if (typeof password !== "string") {
    return { ok: false, reason: "invalid_type" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: "too_short", detail: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: "too_long", detail: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.` };
  }
  return { ok: true };
}

export async function hashPassword(password, opts = {}) {
  const N = opts.N || DEFAULT_N;
  const r = opts.r || DEFAULT_R;
  const p = opts.p || DEFAULT_P;
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * N * r * 4 });
  return `scrypt:${N}:${r}:${p}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt:")) return false;
  const parts = stored.split(":");
  if (parts.length !== 6) return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt, expected;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  let derived;
  try {
    derived = await scryptAsync(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * N * r * 4 });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
