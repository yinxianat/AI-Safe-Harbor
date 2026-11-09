import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");

  const connections = await prisma.connection.findMany({
    where: {
      status: "active",
      OR: [{ userAId: user.id }, { userBId: user.id }],
      ...(connectionId ? { id: connectionId } : {}),
    },
    select: { id: true },
  });

  if (connections.length === 0) {
    return Response.json({ messages: [] });
  }

  const messages = await prisma.message.findMany({
    where: {
      connectionId: { in: connections.map((c) => c.id) },
      senderId: { not: user.id },
      status: "sent",
      senderApproved: true,
      versionSent: "rephrased",
    },
    // contentRaw is deliberately not selected — the receiver must never be able
    // to read the sender's unfiltered original.
    select: {
      id: true,
      contentRephrased: true,
      sentAt: true,
      connectionId: true,
      sender: { select: { displayName: true, email: true } },
    },
    orderBy: { sentAt: "desc" },
    take: 50,
  });

  const formatted = messages
    .filter((m) => m.contentRephrased)
    .map((m) => ({
      id: m.id,
      senderName: m.sender.displayName || m.sender.email,
      content: m.contentRephrased,
      sentAt: m.sentAt?.toISOString(),
      connectionId: m.connectionId,
    }));

  return Response.json({ messages: formatted });
}
