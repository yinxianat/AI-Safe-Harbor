import { requireAdmin } from "@/lib/admin-auth.js";
import { diagnoseEgress } from "@/lib/egress-diagnostic.js";

/**
 * Egress diagnostic for the admin dashboard.
 *
 * Point-in-time picture of what the container can reach: interfaces, DNS
 * resolution (c-ares vs getaddrinfo), and per-port TCP probes against the
 * configured SMTP host. Admin-only, because the resolved IPs and probe
 * timings make it a mild recon surface.
 *
 * Shape is deliberately the same as the structure attached to a failed
 * sendMail's detail blob, so a page that reads one can read the other.
 */
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const host = process.env.SMTP_HOST;
  if (!host) {
    return Response.json(
      { error: "smtp_host_not_configured", detail: "SMTP_HOST is not set on this deployment." },
      { status: 400 }
    );
  }

  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const other = port === 587 ? 465 : 587;
  // force: an operator who pressed the button wants the network as it is now,
  // not the cached picture the error path left behind a minute ago.
  const diagnostic = await diagnoseEgress(host, [port, other], { force: true });
  return Response.json(diagnostic);
}
