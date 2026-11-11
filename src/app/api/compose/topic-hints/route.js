import { getSessionUser } from "@/lib/auth.js";
import { findAccessibleConnection } from "@/lib/connections.js";
import { getTopic, customTopicKeywords } from "@/lib/topics.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  if (!connectionId) {
    return Response.json({ error: "missing_connectionId" }, { status: 400 });
  }

  const connection = await findAccessibleConnection(user.id, connectionId, {
    requireActive: true,
  });
  if (!connection) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const receiverId =
    connection.userAId === user.id ? connection.userBId : connection.userAId;

  const settings = await prisma.topicSetting.findMany({
    where: { connectionId, userId: receiverId },
  });

  const hints = settings
    .filter((s) => s.comfortLevel === "yellow" || s.comfortLevel === "red")
    .map((s) => {
      const topic = getTopic(s.topicName);
      const keywords = topic
        ? topic.keywords
        : s.isCustom
          ? customTopicKeywords(s.sanitizedLabel)
          : [];
      return {
        topicName: s.topicName,
        label: topic?.label ?? s.sanitizedLabel ?? s.topicName,
        level: s.comfortLevel,
        keywords,
      };
    })
    .filter((h) => h.keywords.length > 0);

  return Response.json({ hints });
}
