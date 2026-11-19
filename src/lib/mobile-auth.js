import { SignJWT, jwtVerify } from "jose";
import prisma from "./db.js";
import { getJwtSecret } from "./env.js";

/**
 * JWT-based access and refresh tokens for the iOS client.
 *
 * Cookies work on mobile but are painful across URLSession, WKWebView and
 * logout, so iOS gets a classic Bearer-token flow instead. Both tokens are
 * pure JWTs signed with the same `JWT_SECRET` the web session uses — no
 * new DB table — with a `typ` claim that distinguishes them:
 *
 *   - "access"  : 1h, carries sub + email + plan, accepted by every route
 *                 that calls getSessionUser().
 *   - "refresh" : 90 days, carries sub only, accepted by /api/auth/refresh
 *                 to mint a new access token.
 *
 * The `typ` claim is what keeps a refresh token from being used directly as
 * a session token. verifySession in auth.js refuses anything with
 * `typ === "refresh"`, and verifyRefreshToken here refuses anything whose
 * `typ` is not "refresh". The two sides of the split are checked from the
 * same `JWT_SECRET`, so revocation is "rotate the secret" in a security
 * incident — adequate for v1; a server-side revocation list can be bolted
 * on later if we ever need per-session revocation without logging everyone
 * out at once.
 */

const ACCESS_TTL_SECONDS = 60 * 60;          // 1 hour
const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function key() {
  return new TextEncoder().encode(getJwtSecret());
}

export async function issueAccessToken(user) {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    plan: user.plan || "free",
    typ: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(key());
}

export async function issueRefreshToken(user) {
  return new SignJWT({ userId: user.id, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(key());
}

/**
 * Verify a refresh token and return the user, or null.
 *
 * Strict: only accepts `typ === "refresh"`. A missing `typ` (older web
 * session) and `typ === "access"` are both refused, so an attacker who
 * captured an access token cannot use it to roll the user forward 90 days.
 */
export async function verifyRefreshToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "refresh") return null;
    if (!payload.userId) return null;
    return prisma.user.findUnique({ where: { id: payload.userId } });
  } catch {
    return null;
  }
}

/**
 * Issue both tokens for a signed-in user. Returned together because the
 * mobile login and refresh endpoints both hand the client a pair.
 */
export async function issueTokens(user) {
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(user),
    issueRefreshToken(user),
  ]);
  return { accessToken, refreshToken };
}
