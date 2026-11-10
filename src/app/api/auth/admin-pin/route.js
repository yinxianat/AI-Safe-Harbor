import { NextResponse } from "next/server";
import prisma from "@/lib/db.js";
import { createSession } from "@/lib/auth.js";
import { isAdminEmail } from "@/lib/admin-auth.js";
import {
  pinConfigured,
  verifyPin,
  checkRateLimit,
  recordAttempt,
  clearAttempts,
} from "@/lib/admin-pin.js";
import { parseJsonBody, requireString } from "@/lib/http.js";
import { logError } from "@/lib/logger.js";

/**
 * Bootstrap sign-in with the admin PIN.
 *
 * Only registered when ADMIN_PIN is set; otherwise the endpoint returns 404,
 * which is the same thing the client would see for any typo — the server does
 * not advertise that this door exists on a deployment that has not opened it.
 *
 * The response names no specific failure: an unknown email, an address not on
 * ADMIN_EMAILS, and a wrong PIN all return the same 401. Any discriminating
 * answer would turn this into an admin-list enumeration oracle.
 */
export async function POST(request) {
  if (!pinConfigured()) {
    // 404, not 403 or "disabled" — nothing says this endpoint ever existed on
    // a deployment without the env set.
    return new Response("Not Found", { status: 404 });
  }

  // X-Forwarded-For can be spoofed, but it is still the best per-client key
  // this process has on a platform that NATs every outbound request. The
  // limiter only has to be inconvenient to brute-force, not uncrackable.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return Response.json(
      { error: "too_many_attempts", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    recordAttempt(ip);
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const email = requireString(body.data.email, { maxLength: 320 })?.toLowerCase();
  const pin = requireString(body.data.pin, { maxLength: 256 });

  // Two checks that must not short-circuit on a wrong address: run both and
  // report the same error either way, so timing and response do not leak
  // which half failed.
  const addressIsAdmin = email ? isAdminEmail(email) : false;
  const pinMatches = verifyPin(pin || "");

  if (!addressIsAdmin || !pinMatches) {
    recordAttempt(ip);
    logError(
      "api.auth.admin-pin",
      "admin PIN attempt rejected",
      // Address and IP go in the log, where an admin can see repeat offenders.
      // No PIN value is ever logged, even masked.
      `ip=${ip} email=${email ? `${email.slice(0, 1)}***@${email.split("@")[1] ?? "?"}` : "(missing)"}`
    );
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Both checks pass — provision the session on the existing (or new) user
  // record for that admin address. upsert, because an admin who has never
  // signed in via email yet still has no User row.
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const session = await createSession(user.id);
  clearAttempts(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
