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
      userA: { select: { id: true, displayName: true, username: true, email: true, avatarUrl: true } },
      userB: { select: { id: true, displayName: true, username: true, email: true, avatarUrl: true } },
      preferences: {
        where: { userId: user.id },
        select: { nickname: true },
      },
    },
  });

  const formatted = connections.map((c) => {
    const partner = c.userAId === user.id ? c.userB : c.userA;
    const myPref = c.preferences[0];
    const realName = partner.displayName || (partner.username ? `@${partner.username}` : partner.email);
    return {
      id: c.id,
      partnerId: partner.id,
      // My own label wins. A contact can rename themselves at any time, and
      // callers that resolved the name themselves kept showing whatever the
      // contact had chosen — so the relabel is applied here, once, for every
      // list that renders a partner.
      partnerName: myPref?.nickname || realName,
      // The name they chose, for the secondary line that proves who this is.
      partnerRealName: realName,
      partnerAvatarUrl: partner.avatarUrl || null,
      nickname: myPref?.nickname || null,
      relationshipType: c.relationshipType,
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
