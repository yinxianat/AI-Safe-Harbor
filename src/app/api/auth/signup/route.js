import { createSession } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { checkRateLimit } from "@/lib/rate-limit.js";
import { hashPassword, validatePasswordShape } from "@/lib/password.js";
import prisma from "@/lib/db.js";
import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const email = requireString(body.data.email, { maxLength: 320 })?.toLowerCase();
  const password = typeof body.data.password === "string" ? body.data.password : "";
  const displayName = requireString(body.data.displayName, { maxLength: 50 }) || null;

  if (!email || !email.includes("@")) {
    return badRequest("invalid_email");
  }

  const shape = validatePasswordShape(password);
  if (!shape.ok) {
    return Response.json({ error: shape.reason, detail: shape.detail }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(`signup:${ip}`, { maxRequests: 5, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return Response.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Don't overwrite an existing account's password. Point them to the
    // magic link they can use to sign in, which then lets them set a
    // password through the normal change-password flow.
    return Response.json({ error: "account_exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

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
