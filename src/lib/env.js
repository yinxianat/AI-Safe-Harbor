// Secrets are resolved lazily, never at module load, so that `next build`
// (which imports every route to collect page data) does not require them.
// Any real auth operation fails loudly instead of silently using a known key.

function required(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${name} is not set. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return value;
}

export function getJwtSecret() {
  return required("JWT_SECRET");
}

export function getMagicLinkSecret() {
  return required("MAGIC_LINK_SECRET");
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
