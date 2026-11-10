import { timingSafeEqual } from "crypto";

// A missing secret means CLOSED, never open.
//
// If ADMIN_TOKEN is unset, the admin surface returns 503 — it does not become
// publicly readable. Getting this backwards would expose error logs and
// operational metrics to anyone who guessed the URL.
export function checkAdmin(request) {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected || expected.trim().length === 0) {
    return {
      ok: false,
      response: Response.json(
        { error: "admin_not_configured", detail: "ADMIN_TOKEN is not set." },
        { status: 503 }
      ),
    };
  }

  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : readCookie(request);

  if (!provided || !constantTimeEqual(provided, expected)) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true };
}

function readCookie(request) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("admin_token=")) {
      return decodeURIComponent(trimmed.slice("admin_token=".length));
    }
  }
  return null;
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
