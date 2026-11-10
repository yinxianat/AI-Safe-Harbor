import { getSessionUser } from "@/lib/auth.js";
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
    select: { id: true },
  });

  if (connections.length === 0) {
    return Response.json({ unread: 0 });
  }

  const count = await prisma.message.count({
    where: {
      connectionId: { in: connections.map((c) => c.id) },
      senderId: { not: user.id },
      status: "sent",
      senderApproved: true,
      versionSent: "rephrased",
      readAt: null,
    },
  });

  return Response.json({ unread: count });
}
