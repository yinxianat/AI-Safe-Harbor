import { requireAdmin } from "@/lib/admin-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { sendMail, smtpConfigured, deliveryHealth } from "@/lib/mailer.js";
import { getBaseUrl } from "@/lib/base-url.js";

/**
 * Admin-only email send probe.
 *
 * Fully awaits sendMail — unlike the login and invite routes, which
 * fire-and-forget — and returns the complete result. Lets an operator
 * answer "what did Gmail actually say when we tried to send to X" with
 * a fact instead of a guess. Takes an optional recipient so the probe
 * never targets a user the admin didn't explicitly name.
 *
 * Shape: POST { to, template: "login" | "invite" }.
 * Returns: {
 *   ok,
 *   delivered,
 *   reason,    // "smtp_auth_rejected" | "smtp_sender_rejected" | ...
 *   detail,    // classified remedy + raw SMTP reply
 *   durationMs,
 *   smtpConfigured,
 *   deliveryHealth,
 *   baseUrl,
 * }
 */
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const to = requireString(body.data.to, { maxLength: 320 })?.toLowerCase();
  if (!to || !to.includes("@")) return badRequest("invalid_email");

  const template = body.data.template === "invite" ? "invite" : "login";

  // Build the two shapes side-by-side so the probe reflects what the real
  // routes would send. Any content difference between them that affects
  // deliverability shows up here.
  let baseUrl = null;
  try { baseUrl = getBaseUrl(request); } catch (err) { baseUrl = `[error: ${err.message}]`; }
  const probeLink = `${baseUrl}/__probe?t=${Date.now()}`;

  const subject = template === "invite"
    ? `${auth.user.displayName || auth.user.email.split("@")[0] || "Someone"} invited you to Leeway (test)`
    : "Leeway — Sign In Link (test)";

  const text = template === "invite"
    ? `You've been invited to connect on Leeway.\n\nAccept: ${probeLink}\n\nThis link expires in 15 minutes.`
    : `Click to sign in: ${probeLink}\n\nThis link expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.`;

  const html = template === "invite"
    ? `<p>${auth.user.displayName || "Someone"} invited you to connect on Leeway.</p><p><a href="${probeLink}">Accept Invitation</a></p><p>This link expires in 15 minutes.</p>`
    : `<p>Click to sign in:</p><p><a href="${probeLink}">${probeLink}</a></p><p>This link expires in 15 minutes.</p><p style="color:#64748b;font-size:13px">If you did not request this, you can ignore this email.</p>`;

  const start = Date.now();
  const result = await sendMail({ to, subject, text, html })
    .catch((err) => ({ delivered: false, error: "exception", detail: err?.message || String(err) }));
  const durationMs = Date.now() - start;

  return Response.json({
    ok: Boolean(result?.delivered),
    delivered: Boolean(result?.delivered),
    loggedToConsole: Boolean(result?.loggedToConsole),
    reason: result?.error || null,
    detail: result?.detail || null,
    durationMs,
    smtpConfigured: smtpConfigured(),
    deliveryHealth: deliveryHealth(),
    baseUrl,
    template,
  });
}
