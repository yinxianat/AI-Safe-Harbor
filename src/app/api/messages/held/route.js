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

  const connections = await prisma.connection.findMany({
    where: {
      status: "active",
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    include: { userA: PERSON, userB: PERSON },
  });

  const partnerByConnection = new Map(
    connections.map((c) => [c.id, c.userAId === user.id ? c.userB : c.userA])
  );

  const messages = await prisma.message.findMany({
    where: {
      senderId: user.id,
      status: { in: ["held", "draft"] },
      heldReason: { not: null },
    },
    select: {
      id: true,
      contentRaw: true,
      status: true,
      heldReason: true,
      topicTags: true,
      connectionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const formatted = messages.map((m) => {
    const partner = partnerByConnection.get(m.connectionId);
    return {
      id: m.id,
      partnerName: partner ? personName(partner) : "Unknown",
      contentPreview: m.contentRaw.slice(0, 120) + (m.contentRaw.length > 120 ? "…" : ""),
      status: m.status,
      heldReason: m.heldReason,
      topicTags: m.topicTags,
      createdAt: m.createdAt.toISOString(),
      canRetry: m.heldReason === "ai_failed",
    };
  });

  return Response.json({ messages: formatted });
}
