import { getSessionUser } from "@/lib/auth.js";
import { generateInsight } from "@/lib/ai/index.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [sentCount, receivedCount, recentReactions, connections] = await Promise.all([
    prisma.message.count({
      where: { senderId: user.id, status: "sent", sentAt: { gte: sevenDaysAgo } },
    }),
    prisma.message.count({
      where: {
        connection: {
          OR: [
            { userAId: user.id },
            { userBId: user.id },
          ],
        },
        senderId: { not: user.id },
        status: "sent",
        sentAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.message.findMany({
      where: {
        senderId: user.id,
        status: "sent",
        reaction: { not: null },
        sentAt: { gte: sevenDaysAgo },
      },
      select: { reaction: true },
      take: 20,
    }),
    prisma.connection.findMany({
      where: {
        status: "active",
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      include: {
        topicSettings: {
          where: { userId: { not: user.id } },
          select: { topicName: true, comfortLevel: true },
        },
      },
    }),
  ]);

  const reactionSummary = recentReactions.reduce((acc, m) => {
    acc[m.reaction] = (acc[m.reaction] || 0) + 1;
    return acc;
  }, {});

  const topicSnapshot = connections.flatMap((c) =>
    c.topicSettings.map((ts) => `${ts.topicName}: ${ts.comfortLevel}`)
  );

  const contextParts = [
    `In the past week, you sent ${sentCount} message${sentCount !== 1 ? "s" : ""} and received ${receivedCount}.`,
  ];

  if (Object.keys(reactionSummary).length > 0) {
    const rxStr = Object.entries(reactionSummary)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");
    contextParts.push(`Reactions your messages received: ${rxStr}.`);
  }

  if (topicSnapshot.length > 0) {
    contextParts.push(`Your partner's current topic boundaries: ${topicSnapshot.join(", ")}.`);
  }

  if (sentCount === 0 && receivedCount === 0) {
    contextParts.push("It's been quiet this week — no messages exchanged yet.");
  }

  const context = contextParts.join(" ");
  const result = await generateInsight(context);

  return Response.json({
    insight: result.insight || "Keep communicating openly — every message is a step toward deeper understanding.",
    stats: {
      sentThisWeek: sentCount,
      receivedThisWeek: receivedCount,
      reactions: reactionSummary,
    },
  });
}
