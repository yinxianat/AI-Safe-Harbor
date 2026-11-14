import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";
import { getTopicLabelKey } from "@/lib/topics.js";

const PERSON = {
  select: {
    id: true, username: true, displayName: true,
    tonePreference: true, avatarUrl: true,
    statusText: true, statusMood: true, statusUpdatedAt: true,
    statusVisibleTo: true,
  },
};

/**
 * A status is visible when its owner either left the audience open (empty
 * list) or named this specific connection. Same rule as wall posts and
 * Know Me entries — per-connection isolation, not a global broadcast.
 */
function statusVisibleOn(partner, connectionId) {
  const list = partner.statusVisibleTo;
  return !list || list.length === 0 || list.includes(connectionId);
}

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
    include: {
      userA: PERSON,
      userB: PERSON,
      preferences: {
        where: { userId: user.id },
        select: { nickname: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const members = [];
  const incoming = [];
  const outgoing = [];
  const activeConnectionIds = [];

  for (const c of connections) {
    const partner = c.userAId === user.id ? c.userB : c.userA;
    const showStatus = statusVisibleOn(partner, c.id);
    const myPref = c.preferences?.[0];
    const entry = {
      connectionId: c.id,
      userId: partner.id,
      username: partner.username,
      displayName: partner.displayName || null,
      nickname: myPref?.nickname || null,
      avatarUrl: partner.avatarUrl || null,
      relationshipType: c.relationshipType || "spouse",
      tonePreference: partner.tonePreference || "warm_and_gentle",
      statusText: showStatus ? partner.statusText || null : null,
      statusMood: showStatus ? partner.statusMood || null : null,
      statusUpdatedAt: showStatus ? partner.statusUpdatedAt?.toISOString() || null : null,
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
        labelKey: s.sanitizedLabel ? null : getTopicLabelKey(s.topicName),
        comfortLevel: level,
      });
    }

    for (const m of members) {
      m.boundarySummary = summaryByConn[m.connectionId] || { red: 0, yellow: 0, green: 0 };
      m.boundaries = boundariesByConn[m.connectionId] || [];
    }

    // Activity signals for the people strip: when did this contact's
    // latest status, post, or incoming message happen, and are there any
    // unread messages from them? The strip uses this to ring "fresh" and
    // fade "quiet" contacts, so the user sees at a glance where their
    // attention is wanted.
    const memberByConnection = new Map(members.map((m) => [m.connectionId, m]));
    const partnerIds = members.map((m) => m.userId);

    const [latestPosts, latestMessages, unreadCounts] = await Promise.all([
      prisma.wallPost.groupBy({
        by: ["userId"],
        where: { userId: { in: partnerIds } },
        _max: { createdAt: true },
      }),
      prisma.message.groupBy({
        by: ["senderId", "connectionId"],
        where: {
          senderId: { in: partnerIds },
          connectionId: { in: activeConnectionIds },
          status: "sent",
        },
        _max: { sentAt: true },
      }),
      prisma.message.groupBy({
        by: ["senderId", "connectionId"],
        where: {
          senderId: { in: partnerIds },
          connectionId: { in: activeConnectionIds },
          status: "sent",
          readAt: null,
        },
        _count: true,
      }),
    ]);

    const latestPostByUser = new Map(
      latestPosts.map((r) => [r.userId, r._max.createdAt])
    );
    const latestMsgByConn = new Map(
      latestMessages.map((r) => [r.connectionId, r._max.sentAt])
    );
    const unreadByConn = new Map(
      unreadCounts.map((r) => [r.connectionId, r._count])
    );

    for (const m of members) {
      const times = [
        m.statusUpdatedAt ? new Date(m.statusUpdatedAt).getTime() : null,
        latestPostByUser.get(m.userId)?.getTime() ?? null,
        latestMsgByConn.get(m.connectionId)?.getTime() ?? null,
      ].filter((t) => typeof t === "number");
      m.lastActiveAt = times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
      m.unreadCount = unreadByConn.get(m.connectionId) || 0;
    }
  }

  return Response.json({ members, incoming, outgoing });
}
