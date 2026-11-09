import prisma from "./db.js";

// Single authorization path for "does this user belong to this connection".
// Previously re-implemented in five routes, which is how `status: "active"`
// came to be enforced in some and not others.
export async function findAccessibleConnection(userId, connectionId, { requireActive = true } = {}) {
  if (typeof connectionId !== "string" || connectionId.length === 0) {
    return null;
  }

  return prisma.connection.findFirst({
    where: {
      id: connectionId,
      ...(requireActive ? { status: "active" } : {}),
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  });
}

export function getPartnerId(connection, userId) {
  return connection.userAId === userId ? connection.userBId : connection.userAId;
}
