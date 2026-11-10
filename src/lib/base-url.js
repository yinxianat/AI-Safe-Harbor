import { isProduction } from "./env.js";

/**
 * The origin that magic links are built from.
 *
 * Magic links are bearer credentials, so this must never come from a request
 * header an attacker controls: `Host: attacker.com` with a victim's address
 * would mail that victim a genuine, valid token aimed at the attacker.
 *
 * BASE_URL is therefore required in production; header derivation is a
 * development-only convenience.
 *
 * @throws if BASE_URL is unset in production.
 */
export function getBaseUrl(request) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, "");
  }

  if (isProduction()) {
    throw new Error(
      "BASE_URL must be set in production. Deriving it from request headers would allow host-header injection of magic links."
    );
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}
