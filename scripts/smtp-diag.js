/**
 * SMTP connectivity diagnostic.
 *
 * Run locally to confirm your credentials work, then on Railway to see
 * how DNS resolution and TCP connectivity differ between environments:
 *
 *   node scripts/smtp-diag.js                  # laptop
 *   railway run node scripts/smtp-diag.js       # deployed container
 *
 * Reads SMTP_HOST from the environment (defaults to smtp.gmail.com).
 *
 * The most important output is the DNS comparison: nodemailer uses
 * dns.resolve4/resolve6 (c-ares, direct DNS protocol), while Python's
 * smtplib uses getaddrinfo (system resolver via /etc/resolv.conf and
 * nsswitch). On container platforms with NAT64/DNS64 or overlay
 * networking, these can return DIFFERENT addresses — and only the
 * getaddrinfo ones may be routable.
 */
import { createConnection } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";
import { lookup } from "node:dns/promises";
import { networkInterfaces } from "node:os";

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const TIMEOUT_MS = 10_000;

function testTcp(address, port, family) {
  return new Promise((resolve) => {
    const start = Date.now();
    const sock = createConnection({
      host: address,
      port,
      family: family || (address.includes(":") ? 6 : 4),
    });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({ address, port, ok: false, error: "TIMEOUT", ms: Date.now() - start });
    }, TIMEOUT_MS);
    sock.on("connect", () => {
      clearTimeout(timer);
      sock.destroy();
      resolve({ address, port, ok: true, ms: Date.now() - start });
    });
    sock.on("error", (err) => {
      clearTimeout(timer);
      resolve({ address, port, ok: false, error: err.code, ms: Date.now() - start });
    });
  });
}

async function main() {
  console.log(`\n=== SMTP Connectivity Diagnostic ===`);
  console.log(`Host:  ${host}`);
  console.log(`Node:  ${process.version}`);
  console.log(`Time:  ${new Date().toISOString()}\n`);

  // --- Network interfaces ---
  console.log("--- Network Interfaces ---");
  const ifaces = networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs) {
      const tag = a.internal ? "internal" : "external";
      console.log(`  ${name.padEnd(8)} ${a.family.padEnd(6)} ${a.address.padEnd(42)} ${tag}`);
    }
  }

  const hasExternalIPv4 = Object.values(ifaces).flat().some(a => !a.internal && a.family === "IPv4");
  const hasExternalIPv6 = Object.values(ifaces).flat().some(a => !a.internal && a.family === "IPv6");
  console.log(`\n  External IPv4 interface: ${hasExternalIPv4 ? "YES" : "NO"}`);
  console.log(`  External IPv6 interface: ${hasExternalIPv6 ? "YES" : "NO"}`);
  if (!hasExternalIPv4) {
    console.log("  ⚠ No external IPv4 — nodemailer will skip dns.resolve4 entirely!");
  }

  // --- DNS comparison ---
  console.log("\n--- DNS: c-ares (dns.resolve4/resolve6 — what nodemailer uses) ---");
  let caresV4 = [], caresV6 = [];
  try { caresV4 = await resolve4(host); } catch (e) { console.log(`  IPv4: ${e.code}`); }
  try { caresV6 = await resolve6(host); } catch (e) { console.log(`  IPv6: ${e.code}`); }
  console.log("  IPv4:", caresV4.length ? caresV4.join(", ") : "(none)");
  console.log("  IPv6:", caresV6.length ? caresV6.join(", ") : "(none)");

  console.log("\n--- DNS: getaddrinfo (dns.lookup — what Python smtplib uses) ---");
  let lookupResults = [];
  try {
    lookupResults = await lookup(host, { all: true });
    for (const r of lookupResults) {
      console.log(`  ${r.family === 4 ? "IPv4" : "IPv6"}: ${r.address}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.code}`);
  }

  const caresAll = new Set([...caresV4, ...caresV6]);
  const lookupAll = new Set(lookupResults.map(r => r.address));
  const onlyInCares = [...caresAll].filter(a => !lookupAll.has(a));
  const onlyInLookup = [...lookupAll].filter(a => !caresAll.has(a));

  if (onlyInCares.length || onlyInLookup.length) {
    console.log("\n  ⚠ MISMATCH between c-ares and getaddrinfo!");
    if (onlyInCares.length) console.log("    Only in c-ares:    ", onlyInCares.join(", "));
    if (onlyInLookup.length) console.log("    Only in getaddrinfo:", onlyInLookup.join(", "));
    console.log("    This is likely the cause if nodemailer times out but Python works.");
  } else {
    console.log("\n  ✓ Both resolvers returned the same addresses.");
  }

  // --- TCP connectivity tests ---
  const allAddresses = [...new Set([...caresV4, ...caresV6, ...lookupResults.map(r => r.address)])];
  if (!allAddresses.length) {
    console.log("\nDNS returned nothing. Cannot continue.");
    process.exit(1);
  }

  const smtpPorts = [587, 465];
  let smtpOk = false;

  for (const port of smtpPorts) {
    console.log(`\n--- Port ${port} ---`);
    for (const addr of allAddresses) {
      const source = caresAll.has(addr) && lookupAll.has(addr) ? "both"
        : caresAll.has(addr) ? "c-ares" : "getaddrinfo";
      const r = await testTcp(addr, port);
      const tag = r.ok ? "CONNECTED" : r.error;
      console.log(`  ${addr.padEnd(42)} ${tag.padEnd(12)} ${r.ms}ms  (from: ${source})`);
      if (r.ok) smtpOk = true;
    }
  }

  console.log("\n--- Control: HTTPS port 443 ---");
  for (const addr of caresV4.slice(0, 1)) {
    const r = await testTcp(addr, 443);
    console.log(`  ${addr.padEnd(42)} ${r.ok ? "CONNECTED" : r.error}  ${r.ms}ms`);
  }

  console.log("\n=== Verdict ===");
  if (smtpOk) {
    console.log("At least one SMTP port is reachable.");
    console.log("Check credentials, TLS settings, and SMTP_PORT.");
  } else {
    console.log("Every SMTP port timed out or was refused.");
    console.log("If getaddrinfo addresses differ from c-ares and the platform uses NAT64/DNS64,");
    console.log("the fix is to resolve DNS with dns.lookup (getaddrinfo) and pass a pre-connected");
    console.log("socket to nodemailer via the `connection` option. See src/lib/mailer.js.");
  }
}

main().catch(console.error);
