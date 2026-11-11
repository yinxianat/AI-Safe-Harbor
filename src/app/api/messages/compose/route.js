import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { findAccessibleConnection, getPartnerId } from "@/lib/connections.js";
import prisma from "@/lib/db.js";
import { checkTopicBoundaries } from "@/lib/topic-checker.js";
import { rephraseMessage, analyzeTopics } from "@/lib/ai/index.js";
import { getTopicLabel } from "@/lib/topics.js";
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

  const [receiver, receiverSettings, receiverConnPref] = await Promise.all([
    prisma.user.findUnique({ where: { id: receiverId } }),
    prisma.topicSetting.findMany({ where: { connectionId, userId: receiverId } }),
    prisma.connectionPreference.findUnique({
      where: { connectionId_userId: { connectionId, userId: receiverId } },
    }),
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

  // AI contextual topic analysis — catches indirect references that keyword
  // matching misses (e.g. "how much does it make" for money).
  const nonGreenTopics = receiverSettings
    .filter((s) => s.comfortLevel === "red" || s.comfortLevel === "yellow")
    .map((s) => ({
      key: s.topicName,
      label: s.sanitizedLabel || getTopicLabel(s.topicName),
      level: s.comfortLevel,
    }));

  // Run AI topic analysis and rephrasing in parallel to avoid double latency.
  const [aiTopicCheck, aiResult] = await Promise.all([
    analyzeTopics(contentRaw, nonGreenTopics).catch(() => ({ verdict: "skip", flaggedTopics: [] })),
    rephraseMessage(contentRaw, {
      tonePreference: receiverConnPref?.tonePreference || receiver?.tonePreference,
      yellowTopics,
    }),
  ]);

  // AI caught a red topic that keywords missed — hold the message.
  if (aiTopicCheck.verdict === "blocked") {
    const aiRedTopics = aiTopicCheck.flaggedTopics
      .filter((f) => f.level === "red")
      .map((f) => f.topic);

    const held = await prisma.message.create({
      data: {
        senderId: user.id,
        connectionId,
        contentRaw,
        topicTags: aiRedTopics,
        heldReason: "red_topic",
        status: "held",
      },
    });

    return Response.json({
      held: true,
      heldReason: "red_topic",
      topics: aiRedTopics,
      aiReasons: aiTopicCheck.flaggedTopics.map((f) => f.reason),
      draftId: held.id,
    });
  }

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

  const topicVerdict = aiTopicCheck.verdict === "caution"
    ? { status: "caution", details: aiTopicCheck.flaggedTopics }
    : { status: "clear" };

  return Response.json({
    held: false,
    messageId: message.id,
    raw: contentRaw,
    rephrased: aiResult.rephrased,
    needsSoftening: boundaryCheck.needsSoftening,
    yellowTopics,
    topicVerdict,
  });
}
