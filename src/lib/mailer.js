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
import { diagnoseEgress } from "./egress-diagnostic.js";

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
  // Checked before ENETUNREACH on purpose. A failure list that holds both —
  // a timed-out IPv4 and a routeless IPv6 — means neither family currently
  // works, and the timeout half is the one an operator can act on.
  if (/ECONNREFUSED|ECONNECTION|ETIMEDOUT|ESOCKET|Greeting never received/i.test(text)) {
    return {
      reason: "smtp_unreachable",
      hint:
        "Could not open a session with the mail server, so the credentials were never tested. " +
        "The detail below lists every address tried and how each one failed. Then: " +
        "(1) if an IPv4 timeout appears alongside an IPv6 ENETUNREACH, the platform is likely " +
        "filtering SMTP on its IPv4 path — on Railway, turn on Settings -> Networking -> " +
        "Enable Outbound IPv6 for this service so the IPv6 path exists; " +
        "(2) confirm SMTP_HOST and SMTP_PORT are set on the deployed host, not only in a local .env; " +
        "(3) try the other port — 587 for STARTTLS, 465 for TLS; " +
        "(4) run the /admin egress diagnostic, which reports what both resolvers return, " +
        "which addresses accept a connection, and whether an unrelated mail host accepts port 587. " +
        "A timeout here is a per-address budget expiring, which is not the same as a blocked port; " +
        "the diagnostic tells the two apart, so reach for an HTTPS email API only once it shows every address failing.",
    };
  }
  // Reached only when every attempt was refused instantly for want of a
  // route, which is a different fix from a port that is blocked or slow.
  if (/ENETUNREACH|EHOSTUNREACH/i.test(text)) {
    return {
      reason: "smtp_no_route",
      hint:
        "The host has no route to any resolved address. An IPv6 target with a local address " +
        "of ':::0' means the container has no public IPv6 egress — on Railway, turn on " +
        "Settings -> Networking -> Enable Outbound IPv6 for this service. Only-IPv6 failures " +
        "with no IPv4 attempt listed mean getaddrinfo returned no A record at all; run the " +
        "/admin egress diagnostic to confirm what each resolver returns.",
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

// Per-address slice of the overall connect budget. A family with no route
// fails in ~1ms and costs nothing; the expensive case is a silently-dropped
// port (Railway filters SMTP on the IPv4 NAT path), where only this timer
// moves the loop on to an address that works. 30s on the first address would
// spend the whole budget before the working path was ever tried.
const PER_ADDRESS_CONNECT_MS = 10_000;

async function openSmtpSocket(host, port, timeoutMs) {
  // dns.lookup is getaddrinfo — the resolver Python's smtplib reaches through
  // socket.create_connection — and the addresses are walked in ITS order,
  // exactly as Python does. Do not reorder by family: on Railway the IPv4
  // path silently drops SMTP while enabled IPv6 egress passes, so forcing
  // IPv4 first costs a full per-address timeout on every send. Whichever
  // family is dead fails instantly (ENETUNREACH) and the loop moves on.
  const results = await dnsLookup(host, { all: true });

  // Every attempt is reported, not just the last. A single trailing ENETUNREACH
  // told us nothing about whether any IPv4 address had been tried at all.
  const failures = [];
  const deadline = Date.now() + timeoutMs;
  for (const { address, family } of results) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      failures.push(`${address} -> skipped (${timeoutMs}ms budget spent)`);
      continue;
    }
    try {
      return await connectTo(address, family, port, Math.min(PER_ADDRESS_CONNECT_MS, remaining));
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

// A failure that only names auth, a sender address, or a known typo does not
// benefit from a network diagnostic — it would waste ~5s and bury the real
// cause under noise. Running the diagnostic for network-shaped failures only
// is the point of this guard.
function failureNeedsDiagnostic(reason) {
  return reason === "smtp_unreachable" || reason === "smtp_no_route";
}

// A render that fits in the detail field of one log row. Structured output
// lives in /api/admin/diagnostics; what the log needs is a terse summary plus
// the few rows most often decisive — which addresses got tried on which
// ports, and whether the control port came up — so a reader can diagnose
// from the log entry itself.
function summariseDiagnostic(d) {
  if (!d) return "";
  const probeLines = d.probes
    .map((p) => `  ${p.address.padEnd(42)} :${p.port} ${p.ok ? "OK" : p.code}  ${p.ms}ms  (${p.source})`)
    .join("\n");
  return [
    "",
    `Diagnostic (${d.durationMs}ms${d.fromCache ? `, cached at ${d.cachedAt}` : ""}):`,
    `  ${d.summary}`,
    `  interfaces: ${d.interfaces.length ? d.interfaces.map((i) => `${i.name}:${i.family}:${i.address}`).join(", ") : "(none external)"}`,
    d.egressIp ? `  public egress ip: ${d.egressIp}` : null,
    `  getaddrinfo: ${Array.isArray(d.getaddrinfo) ? d.getaddrinfo.map((r) => `${r.address}(v${r.family})`).join(", ") : `error ${d.getaddrinfo?.error}`}`,
    `  c-ares A: ${Array.isArray(d.cares.ipv4) ? d.cares.ipv4.join(", ") || "(none)" : `error ${d.cares.ipv4?.error}`}`,
    `  c-ares AAAA: ${Array.isArray(d.cares.ipv6) ? d.cares.ipv6.join(", ") || "(none)" : `error ${d.cares.ipv6?.error}`}`,
    probeLines,
    `  control ${d.control.host}:${d.control.port} ${d.control.ok ? `OK ${d.control.ms}ms` : d.control.code} (general egress)`,
    d.smtpControl
      ? `  smtp control ${d.smtpControl.host}:${d.smtpControl.port} ${d.smtpControl.ok ? `OK ${d.smtpControl.ms}ms` : d.smtpControl.code} (unrelated mail host on the SMTP port)`
      : null,
    d.commitSha ? `  commit: ${d.commitSha}` : null,
  ].filter((l) => l !== null).join("\n");
}

// Build the detail blob that goes into a log row or an admin response. The
// diagnostic is attached only for network-shaped failures (see above) and is
// best-effort: if it throws, we still return the original classified error.
async function buildFailureDetail(reason, hint, err, host) {
  const base = `${hint}\n\nServer said: ${err?.code || ""} ${err?.message || err}`.trim();
  if (!host || !failureNeedsDiagnostic(reason)) return { detail: base };

  try {
    const d = await diagnoseEgress(host, [smtpPort(), smtpPort() === 587 ? 465 : 587]);
    return { detail: `${base}\n${summariseDiagnostic(d)}`, diagnostic: d };
  } catch {
    return { detail: base };
  }
}

/**
 * Open a session and authenticate without sending anything, so an operator can
 * tell a blocked port apart from a rejected password.
 *
 * `sendMail` deliberately does not call this — it would double the round trips
 * on every message.
 *
 * @returns {Promise<{ok: boolean, error?: string, detail?: string, host?: string, diagnostic?: object}>}
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
    const { detail, diagnostic } = await buildFailureDetail(reason, hint, err, host);
    return { ok: false, error: reason, detail, host, ...(diagnostic ? { diagnostic } : {}) };
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
    const { detail } = await buildFailureDetail(reason, hint, err, process.env.SMTP_HOST);
    return { delivered: false, error: reason, detail };
  }
}
