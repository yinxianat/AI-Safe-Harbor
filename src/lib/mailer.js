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
import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import { isProduction } from "./env.js";

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

// Generous on purpose. Egress from a container platform to a public mail host
// can take far longer than a laptop on a home network, and `ETIMEDOUT
// Connection timeout` from nodemailer is this limit expiring — not proof that
// the port is blocked. A 10s budget here reported a hard failure against a
// server that was merely slow to accept.
//
// Nothing waits on these: the send is fired after the HTTP response has
// already gone out, so a long ceiling costs a background socket, not a user
// staring at a spinner.
const TIMEOUTS = {
  connectionTimeout: 30_000,
  greetingTimeout: 30_000,
  socketTimeout: 45_000,
};

/**
 * Most recent delivery failure, so the sign-in page can stop telling people to
 * check an inbox we already know we cannot reach.
 *
 * Safe to report to an unauthenticated caller: this is global infrastructure
 * state, identical for a registered and an unregistered address, so it reveals
 * nothing the enumeration-resistant 200 was protecting. Per-address outcomes
 * must never be exposed this way.
 */
const DEGRADED_WINDOW_MS = 10 * 60 * 1000;
let lastFailure = null;

export function deliveryHealth() {
  // An unconfigured mailer in development is the console fallback, which is a
  // working path — the link is read from the terminal. In production the same
  // state means nothing can reach anyone.
  if (!smtpConfigured()) {
    return isProduction()
      ? { degraded: true, reason: "smtp_not_configured" }
      : { degraded: false };
  }

  if (!lastFailure || Date.now() - lastFailure.at > DEGRADED_WINDOW_MS) {
    return { degraded: false };
  }
  return { degraded: true, reason: lastFailure.reason };
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
  // Checked before ENETUNREACH on purpose. A failure list that holds both means
  // IPv4 was tried and timed out while a dual-stack AAAA record merely had no
  // route — the IPv4 timeout is the actionable half.
  if (/ECONNREFUSED|ECONNECTION|ETIMEDOUT|ESOCKET|Greeting never received/i.test(text)) {
    return {
      reason: "smtp_unreachable",
      hint:
        "Could not open a session with the mail server, so the credentials were never tested. " +
        "The detail below lists every address tried and how each one failed. Then: " +
        "(1) confirm SMTP_HOST and SMTP_PORT are set on the deployed host, not only in a local .env; " +
        "(2) try the other port — 587 for STARTTLS, 465 for TLS; " +
        "(3) run scripts/smtp-diag.js on that host, which reports what both resolvers return " +
        "and which addresses accept a connection. " +
        "Note a timeout is this client's own 30s budget expiring, which is not the same as a blocked port; " +
        "the diagnostic tells the two apart, so reach for an HTTPS email API only once it shows every address failing.",
    };
  }
  // Reached only when nothing above matched, i.e. no IPv4 address was tried or
  // returned. The kernel refused instantly for want of a route, which is a
  // different fix from a port that is blocked or slow.
  if (/ENETUNREACH|EHOSTUNREACH/i.test(text)) {
    return {
      reason: "smtp_no_route",
      hint:
        "The host has no route to that address. An IPv6 target with a local address of " +
        "':::0' means getaddrinfo returned AAAA records while the container has no IPv6 " +
        "egress — connection attempts are ordered IPv4-first for exactly this reason, so " +
        "seeing only IPv6 failures means getaddrinfo returned no A record at all. " +
        "Run scripts/smtp-diag.js on the deployed host to confirm what it returns.",
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

// Nodemailer resolves DNS with dns.resolve4/resolve6 (c-ares), which bypasses
// the system resolver. On containers whose IPv4 reachability comes through
// NAT64 or a platform-managed overlay, c-ares returns raw addresses the
// container cannot route, while the C-library getaddrinfo (dns.lookup) returns
// addresses that work — because getaddrinfo honours /etc/resolv.conf, nsswitch
// and any DNS64 synthesis the platform provides. Python's smtplib uses
// getaddrinfo, which is why the same credentials succeed from a Python service
// on the same host and fail from Node.
//
// The fix: resolve the hostname ourselves with dns.lookup (getaddrinfo), open a
// plain TCP socket to the first reachable address, and hand the connected
// socket to nodemailer via the `connection` option. Nodemailer then handles
// EHLO, STARTTLS, AUTH and the message exactly as before.
function smtpPort() {
  return parseInt(process.env.SMTP_PORT || "587", 10);
}

function connectTo(address, family, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: address, port, family });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(Object.assign(new Error(`Timeout connecting to ${address}:${port}`), { code: "ETIMEDOUT" }));
    }, timeoutMs);
    sock.on("connect", () => { clearTimeout(timer); resolve(sock); });
    sock.on("error", (err) => { clearTimeout(timer); sock.destroy(); reject(err); });
  });
}

async function openSmtpSocket(host, port, timeoutMs) {
  // dns.lookup is getaddrinfo — the resolver Python's smtplib reaches through
  // socket.create_connection. IPv4 is tried first because a container
  // platform's public egress is routinely IPv4-only while getaddrinfo still
  // returns AAAA records for a dual-stack host like Gmail; connecting to those
  // fails instantly with ENETUNREACH and must not consume the whole budget.
  const results = await dnsLookup(host, { all: true });
  const ordered = [
    ...results.filter((r) => r.family === 4),
    ...results.filter((r) => r.family !== 4),
  ];

  // Every attempt is reported, not just the last. A single trailing ENETUNREACH
  // told us nothing about whether any IPv4 address had been tried at all.
  const failures = [];
  for (const { address, family } of ordered) {
    try {
      return await connectTo(address, family, port, timeoutMs);
    } catch (err) {
      failures.push(`${address} -> ${err.code || err.message}`);
    }
  }

  if (!failures.length) throw new Error(`getaddrinfo returned no addresses for ${host}`);
  // No `code` on purpose: the per-address codes are in the message, and
  // describeFailure classifies on the combined text. Stamping one code here
  // would mask them.
  throw new Error(
    `No address for ${host} accepted a connection on port ${port}: ${failures.join("; ")}`
  );
}

function buildTransport(socket) {
  const port = smtpPort();
  const opts = {
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: smtpUser(), pass: smtpPass() },
    greetingTimeout: TIMEOUTS.greetingTimeout,
    socketTimeout: TIMEOUTS.socketTimeout,
  };
  if (socket) {
    opts.connection = socket;
  } else {
    opts.connectionTimeout = TIMEOUTS.connectionTimeout;
  }
  return nodemailer.createTransport(opts);
}

/**
 * Open a session and authenticate without sending anything, so an operator can
 * tell a blocked port apart from a rejected password.
 *
 * `sendMail` deliberately does not call this — it would double the round trips
 * on every message.
 *
 * @returns {Promise<{ok: boolean, error?: string, detail?: string, host?: string}>}
 */
export async function verifyTransport() {
  if (!smtpConfigured()) {
    return { ok: false, error: "smtp_not_configured", detail: "SMTP_HOST, user and password must all be set." };
  }

  const host = process.env.SMTP_HOST;
  try {
    const socket = await openSmtpSocket(host, smtpPort(), TIMEOUTS.connectionTimeout);
    await buildTransport(socket).verify();
    return { ok: true, host };
  } catch (err) {
    const { reason, hint } = describeFailure(err);
    return {
      ok: false,
      error: reason,
      detail: `${hint}\n\nServer said: ${err?.code || ""} ${err?.message || err}`.trim(),
      host,
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
    const host = process.env.SMTP_HOST;
    const socket = await openSmtpSocket(host, smtpPort(), TIMEOUTS.connectionTimeout);
    const transporter = buildTransport(socket);

    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject,
      text,
      html,
    });

    lastFailure = null;
    return { delivered: true };
  } catch (err) {
    const { reason, hint } = describeFailure(err);
    lastFailure = { reason, at: Date.now() };
    // console, not the logger — see the recursion note in the file header.
    console.error(`[mailer] ${reason}: ${err?.message}`);
    return {
      delivered: false,
      error: reason,
      detail: `${hint}\n\nServer said: ${err?.code || ""} ${err?.message || err}`.trim(),
    };
  }
}
