import prisma from "@/lib/db.js";

/**
 * Connection lifecycle shared by the circle-request flow and the email-invite
 * flow, so both paths activate a pair the same way.
 */

// The @@unique on Connection is the ordered pair, so the same two people can
// appear in either order; always check both.
export function findConnectionBetween(aId, bId) {
  return prisma.connection.findFirst({
    where: {
      OR: [
        { userAId: aId, userBId: bId },
        { userAId: bId, userBId: aId },
      ],
    },
  });
}

/**
 * Mark a connection active and seed both sides' topic boundaries from their
 * pre-connection defaults. Seeding here — not at first settings visit — means
 * a Red topic set before the pair ever connected is enforced from the very
 * first message. Existing per-connection rows win over defaults.
 */
export async function activateConnection(connectionId) {
  const connection = await prisma.connection.update({
    where: { id: connectionId },
    data: { status: "active" },
  });

  const defaults = await prisma.topicDefault.findMany({
    where: { userId: { in: [connection.userAId, connection.userBId] } },
  });

  if (defaults.length > 0) {
    await prisma.topicSetting.createMany({
      data: defaults.map((d) => ({
        connectionId: connection.id,
        userId: d.userId,
        topicName: d.topicName,
        comfortLevel: d.comfortLevel,
        isCustom: d.isCustom,
        sanitizedLabel: d.sanitizedLabel,
      })),
      skipDuplicates: true,
    });
  }

  return connection;
}
