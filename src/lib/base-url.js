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
/**
 * A deploy-time template variable the hosting provider never got around
 * to substituting. On Railway, `BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`
 * is only resolved when Railway deploys; a local run or a misconfigured
 * deploy passes the literal string through, and every outgoing magic link
 * then points at a URL no browser can reach.
 *
 * Checked specifically rather than treating any BASE_URL failure as unset:
 * the two cases need different error messages, and an operator who sees
 * "BASE_URL unset" when BASE_URL is clearly set in Railway will spend
 * their next ten minutes checking the wrong thing.
 */
function hasUnresolvedTemplate(value) {
  return typeof value === "string" && /\$\{/.test(value);
}

export function getBaseUrl(request) {
  const configured = process.env.BASE_URL;

  if (configured && !hasUnresolvedTemplate(configured)) {
    return configured.replace(/\/$/, "");
  }

  if (isProduction()) {
    throw new Error(
      hasUnresolvedTemplate(configured)
        ? `BASE_URL is set to an unresolved template: "${configured}". ` +
          "This happens when a Railway/Vercel reference like " +
          "${{RAILWAY_PUBLIC_DOMAIN}} isn't expanded at deploy. Set " +
          "BASE_URL to the real public URL (e.g. https://leeway.app)."
        : "BASE_URL must be set in production. Deriving it from request headers would allow host-header injection of magic links."
    );
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}
