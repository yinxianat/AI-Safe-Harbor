import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";

const PERSON = { select: { id: true, username: true, displayName: true } };

/**
 * One call for the whole Circle page: active members, requests waiting on
 * me, and requests I sent that are still pending.
 */
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await prisma.connection.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    include: { userA: PERSON, userB: PERSON },
    orderBy: { createdAt: "desc" },
  });

  const members = [];
  const incoming = [];
  const outgoing = [];

  for (const c of connections) {
    const partner = c.userAId === user.id ? c.userB : c.userA;
    const entry = {
      connectionId: c.id,
      userId: partner.id,
      username: partner.username,
      displayName: partner.displayName || null,
      since: c.createdAt.toISOString(),
    };
    if (c.status === "active") {
      members.push(entry);
    } else if (c.status === "pending") {
      // Legacy pending rows predate requestedById; treat them as incoming for
      // both sides so either person can complete the connection.
      if (c.requestedById === user.id) outgoing.push(entry);
      else incoming.push(entry);
    }
  }

  return Response.json({ members, incoming, outgoing });
}
