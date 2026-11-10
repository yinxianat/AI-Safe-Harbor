import { requireAdmin } from "@/lib/admin-auth.js";
import { getRecentLogs } from "@/lib/diagnostics.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  return Response.json({ logs: await getRecentLogs({ limit }) });
}

// Mark a problem as dealt with. It is not deleted, and it reappears
// automatically if the same fingerprint occurs again — a resolution that can
// silence a recurring fault permanently is worse than no resolution at all.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const id = requireString(body.data.id, { maxLength: 64 });
  if (!id) return badRequest("missing_id");

  const updated = await prisma.logEntry.updateMany({
    where: { id },
    data: { resolvedAt: new Date() },
  });

  if (updated.count !== 1) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ resolved: true });
}
