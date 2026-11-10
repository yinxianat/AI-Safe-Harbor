import { getSessionUser } from "./auth.js";

// Admin is a ROLE, held by named people, not a shared password.
//
// ADMIN_EMAILS lists who holds it. An admin signs in through the normal
// magic-link flow and is recognised by the address on their session, so there
// is no second credential to distribute, rotate, or leak — and the audit
// question "who looked at this?" has an answer.
//
// The list lives in the environment rather than the database so that granting
// admin cannot be done from inside the app: a compromised account cannot
// promote itself. The cost is a redeploy to change the list, which at this
// scale is the right trade.

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || "";
  return [
    ...new Set(
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@"))
    ),
  ];
}

// Compared lowercase and trimmed, so "Alice@Example.com " cannot be used to
// slip past a list containing "alice@example.com", and the reverse cannot be
// used to deny a legitimate admin.
export function isAdminEmail(email) {
  if (typeof email !== "string") return false;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.trim().toLowerCase());
}

/**
 * Gate an admin route. Returns { ok: true, user } or { ok: false, response }.
 *
 * Three distinct failures, deliberately distinguished:
 *   503 — no admins configured. Fails CLOSED: an empty list means nobody is an
 *         admin, never everybody.
 *   401 — not signed in.
 *   403 — signed in, but not an admin.
 */
export async function requireAdmin(request) {
  if (getAdminEmails().length === 0) {
    return {
      ok: false,
      response: Response.json(
        { error: "admin_not_configured", detail: "ADMIN_EMAILS is not set." },
        { status: 503 }
      ),
    };
  }

  const user = await getSessionUser(request);

  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  if (!isAdminEmail(user.email)) {
    // Deliberately does not say who IS an admin.
    return {
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
