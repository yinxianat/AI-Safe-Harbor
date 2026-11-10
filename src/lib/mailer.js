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

export async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n--- email to ${to} ---\n${subject}\n${text}\n`);
    return { delivered: false, loggedToConsole: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false,
      auth: {
        user: smtpUser(),
        pass: smtpPass(),
      },
    });

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
    console.error("[mailer] SMTP delivery failed:", err?.message);
    return { delivered: false, error: "smtp_failed" };
  }
}
