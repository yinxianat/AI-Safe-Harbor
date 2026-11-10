import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";

/**
 * Find people by handle or display name. Only users who have claimed a
 * username appear — claiming it is opting into being findable. Email is
 * never searched and never returned: handles exist precisely so addresses
 * don't have to be shared.
 */
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 50);
  if (q.length < 2) {
    return Response.json({ results: [] });
  }

  const [matches, myConnections] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: user.id },
        username: { not: null },
        OR: [
          { username: { contains: q.toLowerCase() } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, username: true, displayName: true },
      take: 10,
      orderBy: { username: "asc" },
    }),
    prisma.connection.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      select: { id: true, userAId: true, userBId: true, status: true, requestedById: true },
    }),
  ]);

  const byPartner = new Map();
  for (const c of myConnections) {
    const partnerId = c.userAId === user.id ? c.userBId : c.userAId;
    byPartner.set(partnerId, c);
  }

  const results = matches.map((m) => {
    const conn = byPartner.get(m.id);
    let status = "none";
    if (conn?.status === "active") status = "connected";
    else if (conn?.status === "pending") {
      status = conn.requestedById === user.id ? "request_sent" : "request_received";
    }
    return {
      id: m.id,
      username: m.username,
      displayName: m.displayName || null,
      status,
      connectionId: conn?.id || null,
    };
  });

  return Response.json({ results });
}
