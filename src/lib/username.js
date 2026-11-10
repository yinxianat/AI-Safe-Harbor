/**
 * Username (handle) rules: 3-20 chars of a-z, 0-9 and underscore, stored
 * lowercase. The handle is how people find each other in-app; sign-in stays
 * on email, so losing or changing a handle never locks anyone out.
 */

// Route names and operator words. Claiming one would either shadow a URL or
// let a user pass as the product ("@leeway_support").
const RESERVED = new Set([
  "admin", "leeway", "support", "help", "about", "settings", "inbox",
  "compose", "circle", "dashboard", "invite", "api", "me", "system",
  "official", "moderator",
]);

export function normalizeUsername(raw) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * @returns {{ok: true, username: string} | {ok: false, error: string}}
 *   `error` names the fix, not the verdict — it is shown directly to the user.
 */
export function validateUsername(raw) {
  const username = normalizeUsername(raw);
  if (username.length === 0) {
    return { ok: false, error: "Pick a username — 3 to 20 letters, numbers or underscores." };
  }
  if (username.length < 3) {
    return { ok: false, error: "That's too short — use at least 3 characters." };
  }
  if (username.length > 20) {
    return { ok: false, error: "That's too long — 20 characters at most." };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { ok: false, error: "Only letters, numbers and underscores — no spaces or symbols." };
  }
  if (RESERVED.has(username)) {
    return { ok: false, error: "That name is reserved — pick another." };
  }
  return { ok: true, username };
}
