import { requireAdmin } from "@/lib/admin-auth.js";
import { verifyTransport } from "@/lib/mailer.js";

// Answers the one question the logs could not: is delivery failing because the
// credentials are wrong, or because this host cannot reach the mail server at
// all? Those have completely different fixes, and guessing between them from a
// generic "smtp_failed" wasted a day.
//
// Opens a session and authenticates; sends nothing. Admin-only, because the
// response names the configured host.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const started = Date.now();
  const result = await verifyTransport();

  return Response.json({
    ...result,
    // A failure that takes the full connection timeout is a blocked port or a
    // dead route; one that returns quickly is the server actively refusing.
    elapsedMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  });
}
