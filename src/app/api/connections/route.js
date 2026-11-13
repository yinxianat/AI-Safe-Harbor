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
    include: {
      userA: { select: { id: true, displayName: true, username: true, email: true, avatarUrl: true } },
      userB: { select: { id: true, displayName: true, username: true, email: true, avatarUrl: true } },
    },
  });

  const formatted = connections.map((c) => {
    const partner = c.userAId === user.id ? c.userB : c.userA;
    return {
      id: c.id,
      partnerId: partner.id,
      partnerName: partner.displayName || (partner.username ? `@${partner.username}` : partner.email),
      partnerAvatarUrl: partner.avatarUrl || null,
      relationshipType: c.relationshipType,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return Response.json({ connections: formatted });
}
