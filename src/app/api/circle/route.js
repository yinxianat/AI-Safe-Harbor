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
      relationshipType: c.relationshipType || "spouse",
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

  if (activeConnectionIds.length > 0) {
    const allSettings = await prisma.topicSetting.findMany({
      where: {
        connectionId: { in: activeConnectionIds },
        userId: { not: user.id },
      },
      select: { connectionId: true, topicName: true, comfortLevel: true, sanitizedLabel: true, isCustom: true },
    });

    const summaryByConn = {};
    const boundariesByConn = {};
    for (const s of allSettings) {
      if (!summaryByConn[s.connectionId]) summaryByConn[s.connectionId] = { red: 0, yellow: 0, green: 0 };
      if (!boundariesByConn[s.connectionId]) boundariesByConn[s.connectionId] = [];
      const level = s.comfortLevel || "green";
      if (summaryByConn[s.connectionId][level] !== undefined) summaryByConn[s.connectionId][level]++;
      boundariesByConn[s.connectionId].push({
        topicName: s.topicName,
        label: s.sanitizedLabel || s.topicName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        comfortLevel: level,
      });
    }

    for (const m of members) {
      m.boundarySummary = summaryByConn[m.connectionId] || { red: 0, yellow: 0, green: 0 };
      m.boundaries = boundariesByConn[m.connectionId] || [];
    }
  }

  return Response.json({ members, incoming, outgoing });
}
