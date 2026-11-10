import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";

const PERSON = { select: { displayName: true, email: true, username: true } };

function personName(p) {
  return p.displayName || (p.username ? `@${p.username}` : p.email);
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  const box = searchParams.get("box") === "sent" ? "sent" : "received";

  const connections = await prisma.connection.findMany({
    where: {
      status: "active",
      OR: [{ userAId: user.id }, { userBId: user.id }],
      ...(connectionId ? { id: connectionId } : {}),
    },
    include: { userA: PERSON, userB: PERSON },
  });

  if (connections.length === 0) {
    return Response.json({ messages: [] });
  }

  const partnerByConnection = new Map(
    connections.map((c) => [c.id, c.userAId === user.id ? c.userB : c.userA])
  );

  const messages = await prisma.message.findMany({
    where: {
      connectionId: { in: connections.map((c) => c.id) },
      senderId: box === "sent" ? user.id : { not: user.id },
      status: "sent",
      senderApproved: true,
      versionSent: "rephrased",
    },
    // contentRaw is deliberately not selected — the receiver must never be able
    // to read the sender's unfiltered original, and the Sent view shows what
    // was actually delivered.
    select: {
      id: true,
      contentRephrased: true,
      sentAt: true,
      connectionId: true,
      reaction: true,
      sender: PERSON,
    },
    orderBy: { sentAt: "desc" },
    take: 50,
  });

  const formatted = messages
    .filter((m) => m.contentRephrased)
    .map((m) => ({
      id: m.id,
      senderName: personName(m.sender),
      partnerName: personName(partnerByConnection.get(m.connectionId) || m.sender),
      content: m.contentRephrased,
      sentAt: m.sentAt?.toISOString(),
      connectionId: m.connectionId,
      reaction: m.reaction || null,
      box,
    }));

  return Response.json({ messages: formatted });
}
