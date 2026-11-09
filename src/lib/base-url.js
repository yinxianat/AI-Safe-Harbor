import { isProduction } from "./env.js";

// Magic links are bearer credentials, so the host they point at must never be
// taken from a request header an attacker controls. Sending
// `Host: attacker.com` with a victim's email would otherwise mail that victim
// a genuine, valid token aimed at the attacker's domain.
//
// In production BASE_URL is therefore required. Header derivation is a
// development-only convenience.
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
