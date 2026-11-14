import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await prisma.connection.findMany({
    where: {
      status: "active",
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    include: {
      userA: {
        select: {
          id: true, displayName: true, username: true, email: true, avatarUrl: true,
          tonePreference: true,
          statusText: true, statusUpdatedAt: true, statusVisibleTo: true,
        },
      },
      userB: {
        select: {
          id: true, displayName: true, username: true, email: true, avatarUrl: true,
          tonePreference: true,
          statusText: true, statusUpdatedAt: true, statusVisibleTo: true,
        },
      },
      preferences: {
        where: { userId: user.id },
        // Per-connection tone wins over the account-wide one, for the same
        // reason it wins in rephrasing: the receiver might not want the same
        // register with every contact.
        select: { nickname: true, tonePreference: true },
      },
    },
  });

  const formatted = connections.map((c) => {
    const partner = c.userAId === user.id ? c.userB : c.userA;
    const myPref = c.preferences[0];
    const realName = partner.displayName || (partner.username ? `@${partner.username}` : partner.email);

    // Honour the per-connection status audience. The receiver's choice of
    // who can see a status is the same rule used across the app.
    const statusList = partner.statusVisibleTo || [];
    const statusVisible = statusList.length === 0 || statusList.includes(c.id);

    return {
      id: c.id,
      partnerId: partner.id,
      partnerName: myPref?.nickname || realName,
      partnerRealName: realName,
      partnerAvatarUrl: partner.avatarUrl || null,
      nickname: myPref?.nickname || null,
      relationshipType: c.relationshipType,
      // The tone they asked to be spoken in on this connection, for the
      // brief line on the chat card. Account-wide preference is the fallback.
      partnerTonePreference: partner.tonePreference || "warm_and_gentle",
      // What I asked to be spoken in; shown on my side of the card so I
      // remember which register their messages come to me in. Null when I
      // never set a per-connection override.
      myTonePreference: myPref?.tonePreference || null,
      // Status text as it should be on the chat card: short, and only if
      // the partner opted this connection into seeing it.
      statusText: statusVisible ? partner.statusText || null : null,
      statusUpdatedAt: statusVisible
        ? partner.statusUpdatedAt?.toISOString() || null
        : null,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return Response.json({ connections: formatted });
}

/**
 * PATCH — update my settings for a connection (currently: nickname).
 * Creates the ConnectionPreference row if it doesn't exist yet.
 */
export async function PATCH(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const connectionId = requireString(body.data.connectionId, { maxLength: 50 });
  if (!connectionId) return badRequest("missing_connection_id");

  // Verify the caller is part of this connection.
  const conn = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      status: "active",
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });
  if (!conn) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const updates = {};

  if (body.data.nickname !== undefined) {
    const nick = body.data.nickname === null || body.data.nickname === ""
      ? null
      : requireString(body.data.nickname, { maxLength: 50 });
    updates.nickname = nick;
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("nothing_to_update");
  }

  const pref = await prisma.connectionPreference.upsert({
    where: {
      connectionId_userId: { connectionId, userId: user.id },
    },
    create: {
      connectionId,
      userId: user.id,
      ...updates,
    },
    update: updates,
  });

  return Response.json({ nickname: pref.nickname });
}
