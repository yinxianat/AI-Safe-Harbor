import { createSession } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { checkRateLimit } from "@/lib/rate-limit.js";
import { verifyPassword } from "@/lib/password.js";
import prisma from "@/lib/db.js";
import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const email = requireString(body.data.email, { maxLength: 320 })?.toLowerCase();
  const password = typeof body.data.password === "string" ? body.data.password : "";

  if (!email || !password) {
    return badRequest("missing_credentials");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Per-IP AND per-email buckets. Per-IP stops a bot hammering many accounts;
  // per-email stops one hot account being guessed from a residential pool.
  const ipLimit = checkRateLimit(`login:ip:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  const emailLimit = checkRateLimit(`login:email:${email}`, { maxRequests: 10, windowMs: 15 * 60_000 });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfter || 0, emailLimit.retryAfter || 0);
    return Response.json(
      { error: "rate_limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Generic response regardless of whether the account exists or the password
  // matched. Prevents account enumeration via the response or timing.
  const invalid = () => Response.json({ error: "invalid_credentials" }, { status: 401 });

  if (!user || !user.passwordHash) {
    // Still perform a dummy verify to equalize timing with a real check.
    await verifyPassword(password, "scrypt:32768:8:1:00:00").catch(() => false);
    return invalid();
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid();

  const days = user.sessionDays || 30;
  const session = await createSession(user.id, days);

  const response = NextResponse.json({ ok: true, userId: user.id });
  response.cookies.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * days,
    path: "/",
  });
  return response;
}
