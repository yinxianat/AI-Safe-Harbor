import prisma from "@/lib/db.js";
import { resolveChain } from "@/lib/ai/index.js";

// Railway marks a deploy healthy from this endpoint, so it must assert that
// the app is actually USABLE — not merely that the process started.
//
// Checking only the database let a misconfigured deploy go green: with no
// JWT_SECRET the server booted, reported 200, and then failed every sign-in;
// with no BASE_URL it accepted sign-in requests and silently produced no
// email. Both looked perfectly healthy from the outside.
export async function GET() {
  // Fatal: the app cannot serve its purpose at all. Returning 503 keeps
  // Railway from routing traffic to a broken release.
  const fatal = [];
  // Degraded: something is wrong and worth surfacing, but the app still works.
  // These must NOT fail the healthcheck — a missing AI key means messages are
  // held as drafts, which is the designed fallback, not an outage. Failing the
  // deploy over it would turn a degraded feature into a total blackout.
  const warnings = [];

  let database = "connected";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
    fatal.push("database_unreachable");
  }

  for (const name of ["JWT_SECRET", "MAGIC_LINK_SECRET"]) {
    if (!process.env[name]) fatal.push(`missing_${name.toLowerCase()}`);
  }

  if (process.env.NODE_ENV === "production" && !process.env.BASE_URL) {
    fatal.push("missing_base_url");
  }

  if (resolveChain().length === 0) warnings.push("no_ai_provider");
  if (!process.env.SMTP_HOST) warnings.push("smtp_not_configured");

  const status = fatal.length > 0 ? "unhealthy" : warnings.length > 0 ? "degraded" : "ok";

  // Names of missing settings only — never their values, and never the
  // database connection string.
  return Response.json(
    { status, database, fatal, warnings },
    { status: fatal.length > 0 ? 503 : 200 }
  );
}
