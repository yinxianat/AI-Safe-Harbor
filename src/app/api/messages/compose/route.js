import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { findAccessibleConnection, getPartnerId } from "@/lib/connections.js";
import prisma from "@/lib/db.js";
import { checkTopicBoundaries } from "@/lib/topic-checker.js";
import { rephraseMessage } from "@/lib/ai/index.js";
import { logCritical } from "@/lib/logger.js";

const MAX_MESSAGE_LENGTH = 5000;

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const connectionId = requireString(body.data.connectionId, { maxLength: 64 });
  const contentRaw = requireString(body.data.contentRaw, { maxLength: MAX_MESSAGE_LENGTH });

  if (!connectionId) {
    return badRequest("missing_connectionId");
  }
  if (!contentRaw) {
    return badRequest("invalid_contentRaw");
  }

  const connection = await findAccessibleConnection(user.id, connectionId);
  if (!connection) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const receiverId = getPartnerId(connection, user.id);

  const [receiver, receiverSettings] = await Promise.all([
    prisma.user.findUnique({ where: { id: receiverId } }),
    prisma.topicSetting.findMany({ where: { connectionId, userId: receiverId } }),
  ]);

  const boundaryCheck = checkTopicBoundaries(contentRaw, receiverSettings);

  if (boundaryCheck.unenforceable?.length > 0) {
    // A boundary the checker cannot evaluate is a silent safety failure.
    logCritical(
      "api.messages.compose",
      "topic registry drift: boundaries that cannot be enforced",
      boundaryCheck.unenforceable.join(",")
    );
  }

  // Red topic: hold before spending anything on an AI call.
  if (!boundaryCheck.allowed) {
    const held = await prisma.message.create({
      data: {
        senderId: user.id,
        connectionId,
        contentRaw,
        topicTags: boundaryCheck.redTopics || [],
        heldReason: boundaryCheck.heldReason,
        status: "held",
      },
    });

    return Response.json({
      held: true,
      heldReason: boundaryCheck.heldReason,
      topics: boundaryCheck.redTopics,
      draftId: held.id,
    });
  }

  const yellowTopics = boundaryCheck.yellowTopics || [];

  const aiResult = await rephraseMessage(contentRaw, {
    tonePreference: receiver?.tonePreference,
    yellowTopics,
  });

  // Fail closed: no rephrasing means no delivery, only a retrievable draft.
  if (aiResult.error) {
    const draft = await prisma.message.create({
      data: {
        senderId: user.id,
        connectionId,
        contentRaw,
        topicTags: boundaryCheck.topics || [],
        heldReason: "ai_failed",
        status: "draft",
      },
    });

    return Response.json({
      held: true,
      heldReason: "ai_failed",
      draftId: draft.id,
      error: aiResult.error,
    });
  }

  const message = await prisma.message.create({
    data: {
      senderId: user.id,
      connectionId,
      contentRaw,
      contentRephrased: aiResult.rephrased,
      topicTags: boundaryCheck.topics || [],
      aiProvider: aiResult.provider,
      aiModel: aiResult.model,
      aiTokensUsed: aiResult.tokensUsed,
      status: "draft",
    },
  });

  return Response.json({
    held: false,
    messageId: message.id,
    raw: contentRaw,
    rephrased: aiResult.rephrased,
    needsSoftening: boundaryCheck.needsSoftening,
    yellowTopics,
  });
}
