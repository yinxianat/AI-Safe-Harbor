import net from "node:net";
import os from "node:os";
import {
  resolve4 as dnsResolve4,
  resolve6 as dnsResolve6,
  lookup as dnsLookup,
} from "node:dns/promises";

/**
 * Point-in-time picture of a host's reachability from THIS container.
 *
 * The entire reason this module exists: an SMTP timeout in production said
 * "ETIMEDOUT" and nothing else. Four wrong diagnoses later, the fix hinged on
 * facts the running process had all along — which interfaces it had, which
 * addresses `getaddrinfo` returned vs what nodemailer's `c-ares` returned, and
 * which of those addresses actually accepted a TCP connection on the SMTP
 * port. That is what this function captures, in one call, in parallel, inside
 * a bounded budget. The next failure's log row contains the answer.
 *
 * Never throws — a diagnostic that could fail a request is worse than no
 * diagnostic, and this is called on an error path.
 */

const PROBE_TIMEOUT_MS = 5_000;
const CONTROL_PORT = 443;

/**
 * The control probe answers "is outbound traffic broken generally, or only
 * SMTP?" — so it must target a host that genuinely serves 443. Probing 443 on
 * the SMTP host's own IP does NOT work: Gmail's SMTP addresses do not listen
 * on 443, so that control times out on a completely healthy network, and the
 * summary then blames the platform. That false negative is the exact wrong
 * turn that cost days on this bug, so the control gets its own hostname.
 */
const CONTROL_HOST = process.env.EGRESS_CONTROL_HOST || "www.google.com";

/**
 * Second control: an unrelated mail host probed on the SMTP port itself. When
 * every probe to the configured SMTP host fails while 443 works, this is the
 * probe that tells the two remaining causes apart — the platform filtering
 * outbound SMTP ports (this fails too) versus the mail provider refusing this
 * egress IP (this connects). It is a TCP reachability knock only: no account,
 * no login, nothing sent.
 */
const SMTP_CONTROL_HOST = process.env.EGRESS_SMTP_CONTROL_HOST || "smtp-mail.outlook.com";
const SMTP_CONTROL_PORT = 587;

/**
 * Short-lived cache, because the failure path that wants this is also the
 * path that repeats. `logError -> notifyAdmin -> sendMail` means one broken
 * mail server turns every logged error into another diagnostic run, and
 * network reachability does not change second to second. First caller pays
 * the probe budget; everyone within the TTL reads the same picture.
 *
 * `cachedAt` is reported so a reader can tell a fresh probe from a reused one
 * — a stale picture presented as live is how a diagnostic starts lying.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map();

export function __clearDiagnosticCacheForTest() {
  cache.clear();
}

/**
 * @param {string} host     — hostname to probe (SMTP_HOST or equivalent)
 * @param {number[]} ports  — ports to TCP-probe on each resolved address
 * @returns {Promise<{
 *   host: string,
 *   startedAt: string,
 *   durationMs: number,
 *   node: string,
 *   commitSha: string | null,
 *   interfaces: Array<{name: string, family: string, address: string}>,
 *   hasExternalIpv4: boolean,
 *   hasExternalIpv6: boolean,
 *   cares: { ipv4: string[] | {error: string}, ipv6: string[] | {error: string} },
 *   getaddrinfo: Array<{family: number, address: string}> | {error: string},
 *   dnsAgree: boolean,
 *   probes: Array<{address: string, port: number, ok: boolean, code?: string, ms: number, source: string}>,
 *   summary: string,
 * }>}
 */
export async function diagnoseEgress(host, ports = [587, 465], { force = false } = {}) {
  const key = `${host}:${ports.join(",")}`;
  if (!force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return { ...hit.value, fromCache: true, cachedAt: new Date(hit.at).toISOString() };
    }
  }

  const startedAt = new Date().toISOString();
  const start = Date.now();

  // All I/O runs concurrently. The total budget is the slowest branch — a few
  // DNS calls plus one round of TCP probes — not the sum. Each probe has its
  // own timeout so a single black-hole address cannot stall the picture.
  const [ipv4Result, ipv6Result, lookupResult] = await Promise.all([
    dnsResolve4(host).catch((e) => ({ error: e.code || e.message })),
    dnsResolve6(host).catch((e) => ({ error: e.code || e.message })),
    dnsLookup(host, { all: true }).catch((e) => ({ error: e.code || e.message })),
  ]);

  const caresV4 = Array.isArray(ipv4Result) ? ipv4Result : [];
  const caresV6 = Array.isArray(ipv6Result) ? ipv6Result : [];
  const lookupArr = Array.isArray(lookupResult) ? lookupResult : [];
  const caresAll = new Set([...caresV4, ...caresV6]);
  const lookupAll = new Set(lookupArr.map((r) => r.address));

  const sourceOf = (addr) =>
    caresAll.has(addr) && lookupAll.has(addr) ? "both"
      : caresAll.has(addr) ? "c-ares"
        : "getaddrinfo";

  // IPv4 first for the same reason the mailer orders them that way: a
  // routeless IPv6 answer will fail instantly with ENETUNREACH and would
  // otherwise dominate the output.
  const uniqueAddrs = [
    ...Array.from(caresAll).filter((a) => !a.includes(":")),
    ...lookupArr.filter((r) => r.family === 4 && !caresAll.has(r.address)).map((r) => r.address),
    ...Array.from(caresAll).filter((a) => a.includes(":")),
    ...lookupArr.filter((r) => r.family !== 4 && !caresAll.has(r.address)).map((r) => r.address),
  ];

  const probeTargets = uniqueAddrs.flatMap((addr) =>
    ports.map((port) => ({ addr, port }))
  );

  const [probes, control, smtpControl, egressIp] = await Promise.all([
    Promise.all(
      probeTargets.map(({ addr, port }) =>
        probeTcp(addr, port).then((r) => ({ ...r, source: sourceOf(addr) }))
      )
    ),
    probeControl(),
    probeNamedHost(SMTP_CONTROL_HOST, SMTP_CONTROL_PORT),
    discoverEgressIp(),
  ]);

  const interfaces = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces() || {})) {
    for (const a of addrs || []) {
      if (!a.internal) interfaces.push({ name, family: String(a.family), address: a.address });
    }
  }
  const hasExternalIpv4 = interfaces.some((i) => i.family === "IPv4" || i.family === "4");
  const hasExternalIpv6 = interfaces.some((i) => i.family === "IPv6" || i.family === "6");

  const dnsAgree =
    caresAll.size === lookupAll.size &&
    [...caresAll].every((a) => lookupAll.has(a));

  const result = {
    host,
    startedAt,
    durationMs: Date.now() - start,
    fromCache: false,
    node: process.version,
    commitSha:
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GIT_COMMIT_SHA ||
      null,
    interfaces,
    hasExternalIpv4,
    hasExternalIpv6,
    cares: {
      ipv4: Array.isArray(ipv4Result) ? ipv4Result : ipv4Result,
      ipv6: Array.isArray(ipv6Result) ? ipv6Result : ipv6Result,
    },
    getaddrinfo: Array.isArray(lookupResult) ? lookupResult : lookupResult,
    dnsAgree,
    probes,
    control,
    smtpControl,
    egressIp,
    summary: summarise(probes, control, smtpControl, interfaces, hasExternalIpv4, hasExternalIpv6, dnsAgree),
  };

  cache.set(key, { at: Date.now(), value: result });
  return result;
}

// Separate from the SMTP probes because the controls need their own hostnames
// — see CONTROL_HOST and SMTP_CONTROL_HOST. Reported as their own fields so a
// reader never confuses "a control is shut" with "an SMTP address refused".
async function probeControl() {
  return probeNamedHost(CONTROL_HOST, CONTROL_PORT);
}

// The container's PUBLIC exit IP, which its own interfaces cannot reveal —
// traffic leaves through a shared NAT whose address only the far end sees.
// Gmail drops SMTP by sender-IP reputation, so when one service on the same
// plan and region delivers and another cannot, this is the number to compare
// against the Received: header of a mail the working service delivered.
async function discoverEgressIp() {
  try {
    const res = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(3000) });
    const text = (await res.text()).trim();
    return /^[0-9a-f.:]+$/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

async function probeNamedHost(host, port) {
  try {
    const addrs = await dnsLookup(host, { all: true });
    const preferred =
      addrs.find((a) => a.family === 4)?.address || addrs[0]?.address;
    if (!preferred) {
      return { host, port, ok: false, code: "NO_ADDRESS", ms: 0 };
    }
    const r = await probeTcp(preferred, port);
    return { host, ...r };
  } catch (err) {
    return {
      host,
      port,
      ok: false,
      code: err?.code || "DNS_ERROR",
      ms: 0,
    };
  }
}

function probeTcp(address, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const family = address.includes(":") ? 6 : 4;
    const sock = net.createConnection({ host: address, port, family });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({ address, port, ok: false, code: "TIMEOUT", ms: Date.now() - start });
    }, PROBE_TIMEOUT_MS);
    sock.on("connect", () => {
      clearTimeout(timer);
      sock.destroy();
      resolve({ address, port, ok: true, ms: Date.now() - start });
    });
    sock.on("error", (err) => {
      clearTimeout(timer);
      resolve({ address, port, ok: false, code: err.code || "ERROR", ms: Date.now() - start });
    });
  });
}

// A single English sentence an operator can read off the dashboard without
// decoding the structured fields below it. Written for the four cases that
// actually happen, not a general rubric — a vague "mixed results" is worse
// than no sentence.
function summarise(smtpProbes, control, smtpControl, interfaces, hasV4, hasV6, dnsAgree) {
  const anySmtpOk = smtpProbes.some((p) => p.ok);
  const anyIpv4Smtp = smtpProbes.some((p) => !p.address.includes(":"));
  const ipv4SmtpOk = smtpProbes.some((p) => p.ok && !p.address.includes(":"));
  const ipv6SmtpOk = smtpProbes.some((p) => p.ok && p.address.includes(":"));

  if (!interfaces.length) return "Container reports no external network interfaces.";

  if (!anySmtpOk) {
    // Only meaningful because the control has its own hostname: a shut control
    // genuinely means general egress, not an SMTP host that ignores 443.
    if (!control.ok) {
      return `Every SMTP probe failed AND port ${CONTROL_PORT} to ${control.host} failed (${control.code}) — outbound traffic looks broken generally, not SMTP-specific. Check egress and DNS before blaming the mail port.`;
    }
    if (!anyIpv4Smtp && hasV4) {
      return "No IPv4 address was resolved, so only IPv6 was probed, and this host has IPv4 egress. The resolver returned no A record — that is the thing to fix.";
    }
    if (!hasV4 && hasV6) {
      return "This host has only IPv6 egress. If every SMTP target is IPv4, nothing here can connect regardless of the mail configuration.";
    }
    // The SMTP-port control splits the last two causes, which need opposite
    // responses: a filtered port is the platform's to open, a refused egress
    // IP is escaped by changing region or moving to an HTTPS email API.
    if (smtpControl?.ok) {
      return `Every probe to the configured SMTP host failed, but ${smtpControl.host}:${smtpControl.port} accepts connections from here (${smtpControl.ms}ms) and ${CONTROL_PORT} works. The SMTP port is open — the mail provider is refusing this platform's egress IP. Code and credentials are not the problem; change the service's region or send over HTTPS instead.`;
    }
    if (smtpControl && !smtpControl.ok) {
      return `Port ${SMTP_CONTROL_PORT} fails to two unrelated mail hosts (${smtpControl.host}: ${smtpControl.code}) while ${CONTROL_PORT} works. The platform is filtering outbound SMTP from this service — no code change can open it. On Railway, enable Settings -> Networking -> Outbound IPv6 for this service: the SMTP filter sits on the IPv4 path, and the IPv6 path delivers. Otherwise ask the platform, or send over HTTPS instead.`;
    }
    return `Every SMTP probe failed while ${CONTROL_PORT} to ${control.host} succeeded in ${control.ms}ms. General egress works, so this is SMTP-specific: a blocked port or a provider-side rule.`;
  }

  if (ipv4SmtpOk && !ipv6SmtpOk) {
    return "IPv4 SMTP is reachable; IPv6 is not. The mailer walks every resolved address, so a routeless IPv6 costs ~1ms before IPv4 connects.";
  }
  if (!ipv4SmtpOk && ipv6SmtpOk) {
    return "SMTP is reachable over IPv6 only — the expected healthy shape on Railway, whose IPv4 path filters SMTP while enabled Outbound IPv6 delivers. The mailer walks every resolved address, so sends go out over IPv6.";
  }
  if (!dnsAgree) {
    return "SMTP is reachable, but c-ares and getaddrinfo return different addresses. Keep the socket-handoff fix in place — nodemailer's own resolver would pick the other set.";
  }
  return "SMTP port is reachable from this host. If sends still fail, the cause is auth, TLS, or the sender address — not the network.";
}
