import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";

export async function POST(request) {
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
    return Response.json({ marked: 0 });
  }

  const result = await prisma.message.updateMany({
    where: {
      connectionId: { in: connections.map((c) => c.id) },
      senderId: { not: user.id },
      status: "sent",
      senderApproved: true,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return Response.json({ marked: result.count });
}
