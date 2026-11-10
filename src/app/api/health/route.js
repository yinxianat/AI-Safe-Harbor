import prisma from "@/lib/db.js";
import { resolveChain } from "@/lib/ai/index.js";
import { smtpUser, smtpPass, deliveryHealth } from "@/lib/mailer.js";

/**
 * Deploy healthcheck. The platform marks a release healthy from this endpoint,
 * so it must assert the app is actually usable, not merely that the process
 * started.
 *
 * Checking only the database let a misconfigured deploy go green: with no
 * JWT_SECRET the server booted, returned 200, then failed every sign-in; with
 * no BASE_URL it accepted sign-in requests and silently produced no email.
 *
 * @returns 503 with `fatal` when the app cannot work, 200 otherwise —
 *   `warnings` are degradations that still leave it serving.
 */
export async function GET() {
  const fatal = [];
  const warnings = [];

  // "Can I connect?" and "is there a schema?" are different questions, and the
  // second is the one that matters. `SELECT 1` succeeds against a completely
  // empty database, so a deployment whose migrations never ran reported
  // itself healthy while every real query failed.
  let database = "connected";
  try {
    await prisma.user.count();
  } catch (err) {
    // Postgres 42P01 = undefined_table: we reached the database but the schema
    // is not there, which almost always means migrations have not been applied.
    const missingSchema =
      err?.code === "P2021" || /42P01|does not exist/i.test(err?.message || "");

    if (missingSchema) {
      database = "no_schema";
      fatal.push("migrations_not_applied");
    } else {
      database = "unreachable";
      fatal.push("database_unreachable");
    }
  }

  for (const name of ["JWT_SECRET", "MAGIC_LINK_SECRET"]) {
    if (!process.env[name]) fatal.push(`missing_${name.toLowerCase()}`);
  }

  if (process.env.NODE_ENV === "production" && !process.env.BASE_URL) {
    fatal.push("missing_base_url");
  }

  if (resolveChain().length === 0) warnings.push("no_ai_provider");

  // A host with no credentials is worse than no host at all: the app tries to
  // send, the provider rejects it, and the user is told to check an inbox that
  // will never receive anything.
  if (!process.env.SMTP_HOST) {
    warnings.push("smtp_not_configured");
  } else if (!smtpUser() || !smtpPass()) {
    warnings.push("smtp_credentials_incomplete");
  } else {
    // Complete settings are not working settings. This endpoint reported "ok"
    // throughout a period when no email could leave the host at all, because
    // every check it ran was a check on configuration. The last real send
    // result is the only evidence that delivery works, and reading it costs
    // nothing — a live connection test belongs in /api/admin/smtp-test, not in
    // the path a platform polls to decide whether to keep the deploy.
    const mail = deliveryHealth();
    if (mail.degraded) warnings.push(mail.reason);
  }

  const status = fatal.length > 0 ? "unhealthy" : warnings.length > 0 ? "degraded" : "ok";

  // Names of missing settings only — never their values, and never the
  // database connection string.
  return Response.json(
    { status, database, fatal, warnings },
    { status: fatal.length > 0 ? 503 : 200 }
  );
}
