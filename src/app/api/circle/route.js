import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";

const PERSON = {
  select: {
    id: true, username: true, displayName: true,
    tonePreference: true,
    statusText: true, statusMood: true, statusUpdatedAt: true,
  },
};

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
  const activeConnectionIds = [];

  for (const c of connections) {
    const partner = c.userAId === user.id ? c.userB : c.userA;
    const entry = {
      connectionId: c.id,
      userId: partner.id,
      username: partner.username,
      displayName: partner.displayName || null,
      tonePreference: partner.tonePreference || "warm_and_gentle",
      statusText: partner.statusText || null,
      statusMood: partner.statusMood || null,
      statusUpdatedAt: partner.statusUpdatedAt?.toISOString() || null,
      since: c.createdAt.toISOString(),
    };
    if (c.status === "active") {
      members.push(entry);
      activeConnectionIds.push(c.id);
    } else if (c.status === "pending") {
      if (c.requestedById === user.id) outgoing.push(entry);
      else incoming.push(entry);
    }
  }

  // Fetch boundary summary for each active connection (the partner's settings).
  if (activeConnectionIds.length > 0) {
    const allSettings = await prisma.topicSetting.findMany({
      where: {
        connectionId: { in: activeConnectionIds },
        userId: { not: user.id },
      },
      select: { connectionId: true, comfortLevel: true },
    });

    const summaryByConn = {};
    for (const s of allSettings) {
      if (!summaryByConn[s.connectionId]) summaryByConn[s.connectionId] = { red: 0, yellow: 0, green: 0 };
      const level = s.comfortLevel || "green";
      if (summaryByConn[s.connectionId][level] !== undefined) summaryByConn[s.connectionId][level]++;
    }

    for (const m of members) {
      m.boundarySummary = summaryByConn[m.connectionId] || { red: 0, yellow: 0, green: 0 };
    }
  }

  return Response.json({ members, incoming, outgoing });
}
