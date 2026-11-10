import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";
import { checkTopicBoundaries } from "@/lib/topic-checker.js";
import { rephraseMessage } from "@/lib/ai/index.js";

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const messageId = requireString(body.data.messageId, { maxLength: 64 });
  if (!messageId) {
    return badRequest("missing_messageId");
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, senderId: user.id, heldReason: "ai_failed" },
  });

  if (!message) {
    return Response.json({ error: "message_not_found" }, { status: 404 });
  }

  const connection = await prisma.connection.findUnique({
    where: { id: message.connectionId },
  });

  if (!connection || connection.status !== "active") {
    return Response.json({ error: "connection_inactive" }, { status: 403 });
  }

  const receiverId = connection.userAId === user.id ? connection.userBId : connection.userAId;

  const [receiver, receiverSettings] = await Promise.all([
    prisma.user.findUnique({ where: { id: receiverId } }),
    prisma.topicSetting.findMany({ where: { connectionId: message.connectionId, userId: receiverId } }),
  ]);

  const boundaryCheck = checkTopicBoundaries(message.contentRaw, receiverSettings);

  if (!boundaryCheck.allowed) {
    await prisma.message.update({
      where: { id: messageId },
      data: { status: "held", heldReason: boundaryCheck.heldReason, topicTags: boundaryCheck.redTopics || [] },
    });

    return Response.json({
      held: true,
      heldReason: boundaryCheck.heldReason,
      topics: boundaryCheck.redTopics,
    });
  }

  const aiResult = await rephraseMessage(message.contentRaw, {
    tonePreference: receiver?.tonePreference,
    yellowTopics: boundaryCheck.yellowTopics || [],
  });

  if (aiResult.error) {
    return Response.json({
      held: true,
      heldReason: "ai_failed",
      error: aiResult.error,
    });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: {
      contentRephrased: aiResult.rephrased,
      heldReason: null,
      status: "draft",
      aiProvider: aiResult.provider,
      aiModel: aiResult.model,
      aiTokensUsed: aiResult.tokensUsed,
      topicTags: boundaryCheck.topics || [],
    },
  });

  return Response.json({
    held: false,
    messageId,
    raw: message.contentRaw,
    rephrased: aiResult.rephrased,
  });
}
