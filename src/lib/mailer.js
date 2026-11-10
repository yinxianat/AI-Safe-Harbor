/**
 * Outbound email: magic links, invitations, and admin alerts.
 *
 * Two guarantees the callers depend on:
 *
 *   1. Nothing here throws. A broken mail server must not take a request down
 *      with it; every failure comes back as a return value.
 *   2. With no SMTP_HOST, mail is printed to the server log instead of sent.
 *      That is the local-development path — the magic link is read from the
 *      terminal. On a deployed host it means links land in the deploy log, so
 *      SMTP must be configured before real use.
 *
 * Callers must not route a failure from here back through `logger.js`: the
 * alert path is logger -> alerts -> mailer, so that would recurse.
 */
import nodemailer from "nodemailer";

// SMTP_USERNAME/SMTP_PASSWORD are accepted alongside SMTP_USER/SMTP_PASS
// because both are standard, and reading the wrong pair fails in the worst
// possible way: the transport builds, authenticates with `undefined`, the
// provider rejects it, and the user is told to check an inbox that will never
// receive anything.
export function smtpUser() {
  return process.env.SMTP_USER || process.env.SMTP_USERNAME || "";
}

export function smtpPass() {
  return process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
}

// SMTP_HOST alone is not enough — a host with no credentials is what let a
// misconfigured deployment report itself healthy.
export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && smtpUser() && smtpPass());
}

// SMTP_FROM allows a display name ("Leeway <you@gmail.com>"); without it the
// bare login address is used, which works but shows as a raw mailbox. Either
// way the address must be one the authenticated account may send as — most
// providers reject or silently rewrite anything else.
function fromAddress() {
  return process.env.SMTP_FROM || smtpUser();
}

// Without these, a dropped connection holds the socket open for minutes.
const TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
};

// Mail hosts publish both A and AAAA records, and Node 17+ dials them in DNS
// order. Container platforms commonly assign an IPv6 address with no egress
// route, so an IPv6 attempt hangs until the timeout rather than failing fast.
// Defaults to IPv4; set SMTP_IP_FAMILY=6 or 0 to override.
function ipFamily() {
  const raw = process.env.SMTP_IP_FAMILY;
  if (raw === undefined || raw === "") return 4;
  const parsed = parseInt(raw, 10);
  return [0, 4, 6].includes(parsed) ? parsed : 4;
}

// "smtp_failed" tells an operator nothing. These turn the provider's raw
// response into something that names the actual fix, because the whole point
// of persisting the error is to shorten the next diagnosis.
function describeFailure(err) {
  const code = err?.code || err?.responseCode || "";
  const message = err?.message || String(err);
  const text = `${code} ${message}`;

  if (/EAUTH|535|Username and Password not accepted|BadCredentials/i.test(text)) {
    return {
      reason: "smtp_auth_rejected",
      hint:
        "The mail server rejected the credentials. For Gmail this must be a 16-character App Password, not the account password, and SMTP_USER must be the full address.",
    };
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return { reason: "smtp_host_not_found", hint: "SMTP_HOST does not resolve. Check it for typos." };
  }
  if (/ECONNREFUSED|ECONNECTION|ETIMEDOUT|ESOCKET|Greeting never received/i.test(text)) {
    return {
      reason: "smtp_unreachable",
      hint:
        "Could not open a session with the mail server, and the credentials were never tested. " +
        "Check SMTP_HOST and SMTP_PORT (587 for STARTTLS, 465 for TLS). " +
        "If the same settings work from a laptop but time out here, the host is reachable and this is the deploy platform, not the configuration: " +
        "either outbound SMTP is blocked on the current plan (Railway blocks it below Pro), or the connection went out over IPv6 with no return route. " +
        "This app forces IPv4 already; if it is a plan-level block, no SMTP port will work and delivery has to move to an HTTPS email API such as Resend, SendGrid or Postmark.",
    };
  }
  if (/EENVELOPE|550|553|Sender address rejected/i.test(text)) {
    return {
      reason: "smtp_sender_rejected",
      hint: "The server refused the From address. It must be one the authenticated account may send as.",
    };
  }
  return { reason: "smtp_failed", hint: "Unclassified SMTP failure; see detail." };
}

function buildTransport() {
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: smtpUser(),
      pass: smtpPass(),
    },
    family: ipFamily(),
    ...TIMEOUTS,
  });
}

/**
 * Open a session and authenticate without sending anything, so an operator can
 * tell a blocked port apart from a rejected password.
 *
 * `sendMail` deliberately does not call this — it would double the round trips
 * on every message.
 *
 * @returns {Promise<{ok: boolean, error?: string, detail?: string, family?: number, host?: string}>}
 */
export async function verifyTransport() {
  if (!smtpConfigured()) {
    return { ok: false, error: "smtp_not_configured", detail: "SMTP_HOST, user and password must all be set." };
  }

  try {
    await buildTransport().verify();
    return { ok: true, family: ipFamily(), host: process.env.SMTP_HOST };
  } catch (err) {
    const { reason, hint } = describeFailure(err);
    return {
      ok: false,
      error: reason,
      detail: `${hint}\n\nServer said: ${err?.code || ""} ${err?.message || err}`.trim(),
      family: ipFamily(),
      host: process.env.SMTP_HOST,
    };
  }
}

/**
 * Send one message. Never throws; check the return value.
 *
 * @returns {Promise<{delivered: boolean, loggedToConsole?: boolean, error?: string, detail?: string}>}
 *   `detail` carries the classified remedy and the raw server response, and is
 *   what belongs in a log entry — `error` alone is a code, not a diagnosis.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n--- email to ${to} ---\n${subject}\n${text}\n`);
    return { delivered: false, loggedToConsole: true };
  }

  try {
    const transporter = buildTransport();

    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject,
      text,
      html,
    });

    return { delivered: true };
  } catch (err) {
    const { reason, hint } = describeFailure(err);
    // console, not the logger — see the recursion note in the file header.
    console.error(`[mailer] ${reason}: ${err?.message}`);
    return {
      delivered: false,
      error: reason,
      detail: `${hint}\n\nServer said: ${err?.code || ""} ${err?.message || err}`.trim(),
    };
  }
}
