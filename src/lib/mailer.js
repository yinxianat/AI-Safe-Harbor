import nodemailer from "nodemailer";

// With no SMTP_HOST configured, mail is written to the server log instead.
// That is the intended local-development path — the magic link is read from
// the terminal. On a deployed host it means links land in the deploy logs,
// so SMTP must be configured before real use.
// This function never throws. A broken mail server must not take a request
// down with it — the caller decides what the user sees, and for both the login
// and invite flows that is a success response either way (the response must
// not reveal whether an address exists or whether delivery worked).
// The address recipients see. SMTP_FROM allows a display name
// ("Leeway <you@gmail.com>"); without it we fall back to the bare login
// address, which is functional but shows up as a raw mailbox in the inbox.
//
// Most providers, Gmail included, require the address inside SMTP_FROM to be
// one the authenticated account is allowed to send as — usually SMTP_USER
// itself or a verified alias. A mismatch is rejected at send time or silently
// rewritten, so keep them the same unless you have set up an alias.
// SMTP_USERNAME / SMTP_PASSWORD are accepted as aliases because they are at
// least as common a convention as USER / PASS, and getting it wrong fails in
// the worst possible way: the transport is created, Gmail rejects the
// credentials, and the user sees "check your email" for a message that was
// never sent. Accepting both removes a whole class of silent misconfiguration.
export function smtpUser() {
  return process.env.SMTP_USER || process.env.SMTP_USERNAME || "";
}

export function smtpPass() {
  return process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
}

// True when SMTP is configured well enough to actually authenticate.
// SMTP_HOST alone is not enough — that was the gap that let a deployment with
// no credentials report itself healthy.
export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && smtpUser() && smtpPass());
}

function fromAddress() {
  return process.env.SMTP_FROM || smtpUser();
}

// Without these, a wrong host or a silently dropped connection leaves the
// socket open for minutes. The request that triggered the send waits the whole
// time, which is how "the page just spins" happens.
const TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
};

// Force IPv4 unless explicitly overridden.
//
// smtp.gmail.com publishes both A and AAAA records. Node 17+ defaults to
// `verbatim: true` DNS ordering, so it may try the IPv6 address first. Many
// container platforms (Railway among them) hand the container an IPv6 address
// with no working egress route, so that attempt does not fail fast — it hangs
// until the connection timeout. The symptom is a connect timeout with no
// authentication error, which reads as "the mail server is unreachable" even
// though the credentials and host are perfectly correct and the same settings
// work from a laptop.
//
// Set SMTP_IP_FAMILY=6 to force IPv6, or 0 to use the system default.
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

// Opens a session and authenticates WITHOUT sending anything, so an operator
// can tell a blocked port apart from a rejected password. Used by the admin
// diagnostic endpoint; `sendMail` does not call it, because that would double
// the round trips on every message.
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
    // console, NOT the logger. This module is called by the alerting path
    // (logger -> alerts -> mailer); routing a delivery failure back into the
    // logger would recurse forever. Callers that are not the alert path check
    // the return value and log it themselves.
    const { reason, hint } = describeFailure(err);
    console.error(`[mailer] ${reason}: ${err?.message}`);
    return {
      delivered: false,
      error: reason,
      // Passed to the caller so it reaches the persisted log. Redaction runs
      // on the way in, so a credential echoed by the server is stripped.
      detail: `${hint}\n\nServer said: ${err?.code || ""} ${err?.message || err}`.trim(),
    };
  }
}
