import { verifyMagicToken } from "@/lib/auth.js";
import { issueTokens } from "@/lib/mobile-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { checkRateLimit } from "@/lib/rate-limit.js";
import { verifyPassword } from "@/lib/password.js";
import prisma from "@/lib/db.js";

/**
 * Mobile sign-in. Two modes, one endpoint:
 *
 *   { email, password }     → bearer tokens, if the password matches
 *   { email, magicCode }    → bearer tokens, if the magic-link code is live
 *
 * No cookies. The client stores both tokens in Keychain and sends the
 * access one as `Authorization: Bearer <token>` on every subsequent call.
 */
export async function POST(request) {
  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const email = requireString(body.data.email, { maxLength: 320 })?.toLowerCase();
  const password = typeof body.data.password === "string" ? body.data.password : "";
  const magicCode = typeof body.data.magicCode === "string" ? body.data.magicCode : "";

  if (!email) return badRequest("missing_email");
  if (!password && !magicCode) return badRequest("missing_credentials");

  // Same rate-limit shape as /api/auth/login — per-IP and per-email — so
  // bursts and credential stuffing hit the same wall regardless of the
  // sign-in surface.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipLimit = checkRateLimit(`mlogin:ip:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  const emailLimit = checkRateLimit(`mlogin:email:${email}`, { maxRequests: 10, windowMs: 15 * 60_000 });
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfter || 0, emailLimit.retryAfter || 0);
    return Response.json(
      { error: "rate_limited", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let user = null;

  if (magicCode) {
    const result = await verifyMagicToken(magicCode, "login");
    if (!result.valid || result.email?.toLowerCase() !== email) {
      return Response.json({ error: "invalid_code" }, { status: 401 });
    }
    user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  } else {
    const found = await prisma.user.findUnique({ where: { email } });
    const invalid = () => Response.json({ error: "invalid_credentials" }, { status: 401 });

    if (!found || !found.passwordHash) {
      // Timing-equalise with a dummy verify; see the web login route for the
      // same pattern.
      await verifyPassword(password, "scrypt:32768:8:1:00:00").catch(() => false);
      return invalid();
    }
    if (!(await verifyPassword(password, found.passwordHash))) return invalid();
    user = found;
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return Response.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username || null,
      displayName: user.displayName || null,
      locale: user.locale || "en",
      theme: user.theme || "light",
      plan: user.plan || "free",
      avatarUrl: user.avatarUrl || null,
    },
  });
}
