import prisma from "./db.js";

/**
 * Every active contact of `userId`, with the boundaries and tone preference
 * THAT CONTACT set for this connection.
 *
 * The direction matters: a note the author publishes is received by the
 * contact, so the contact's own settings decide whether it reaches them and
 * how it should read — never the author's.
 */
export async function loadContactsWithBoundaries(userId) {
  const connections = await prisma.connection.findMany({
    where: { status: "active", OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, displayName: true, username: true, email: true, tonePreference: true, avatarUrl: true } },
      userB: { select: { id: true, displayName: true, username: true, email: true, tonePreference: true, avatarUrl: true } },
    },
  });

  if (connections.length === 0) return [];

  const connectionIds = connections.map((c) => c.id);

  // The contact's settings, not the author's — hence userId: { not: userId }.
  const settings = await prisma.topicSetting.findMany({
    where: { connectionId: { in: connectionIds }, userId: { not: userId } },
    select: {
      connectionId: true, topicName: true, comfortLevel: true,
      isCustom: true, sanitizedLabel: true, note: true,
    },
  });

  const prefs = await prisma.connectionPreference.findMany({
    where: { connectionId: { in: connectionIds }, userId: { not: userId } },
    select: { connectionId: true, tonePreference: true, tonePrompt: true },
  });

  const settingsByConnection = {};
  for (const s of settings) {
    (settingsByConnection[s.connectionId] ||= []).push(s);
  }
  const prefByConnection = Object.fromEntries(prefs.map((p) => [p.connectionId, p]));

  return connections.map((c) => {
    const partner = c.userAId === userId ? c.userB : c.userA;
    const pref = prefByConnection[c.id];
    return {
      connectionId: c.id,
      partnerId: partner.id,
      name: partner.displayName || (partner.username ? `@${partner.username}` : partner.email),
      avatarUrl: partner.avatarUrl || null,
      relationshipType: c.relationshipType || "spouse",
      // Per-connection override wins over the account-wide preference.
      tonePreference: pref?.tonePreference || partner.tonePreference || "warm_and_gentle",
      tonePrompt: pref?.tonePrompt || null,
      topicSettings: settingsByConnection[c.id] || [],
    };
  });
}
