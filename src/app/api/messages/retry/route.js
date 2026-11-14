import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";
import { detectsCrisis } from "@/lib/crisis.js";
import { checkTopicBoundaries } from "@/lib/topic-checker.js";
import { rephraseMessage, analyzeTopics } from "@/lib/ai/index.js";
import { getTopicLabel } from "@/lib/topics.js";
import {
  loadReceiverContext,
  buildRephraseSettings,
  appliedSummary,
} from "@/lib/receiver-settings.js";

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

  const crisis = detectsCrisis(message.contentRaw);

  const connection = await prisma.connection.findUnique({
    where: { id: message.connectionId },
  });

  if (!connection || connection.status !== "active") {
    return Response.json({ error: "connection_inactive" }, { status: 403 });
  }

  const receiverId = connection.userAId === user.id ? connection.userBId : connection.userAId;

  const { receiver, topicSettings: receiverSettings, connPref: receiverConnPref } =
    await loadReceiverContext(message.connectionId, receiverId);

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
      crisis,
    });
  }

  // Always run the AI classifier on retry, not only when the keyword
  // layer flagged a red-with-note topic. The previous code skipped the
  // classifier entirely for any retry whose keyword pass was clean, so
  // an indirect reference the keywords missed ("how much do you bring
  // in" for Money) could sneak through on the retry path even though
  // compose would have caught it. The governance audit flagged this
  // as a High.
  const nonGreenTopics = receiverSettings
    .filter((s) => s.comfortLevel === "red" || s.comfortLevel === "yellow")
    .map((s) => ({
      key: s.topicName,
      label: s.sanitizedLabel || getTopicLabel(s.topicName),
      level: s.comfortLevel,
      note: s.note || null,
    }));

  const aiTopicCheck = nonGreenTopics.length === 0
    ? { verdict: "clear", flaggedTopics: [] }
    : await analyzeTopics(message.contentRaw, nonGreenTopics)
        .catch(() => ({ verdict: "skip", flaggedTopics: [] }));

  if (aiTopicCheck.verdict === "blocked") {
    const topics = aiTopicCheck.flaggedTopics
      .filter((f) => f.level === "red")
      .map((f) => f.key);
    await prisma.message.update({
      where: { id: messageId },
      data: { status: "held", heldReason: "red_topic", topicTags: topics },
    });
    return Response.json({ held: true, heldReason: "red_topic", topics, crisis });
  }

  // Keyword hit a red-with-note topic AND the AI couldn't adjudicate it.
  // Fail closed: hold as red_topic because we can't confirm the note's
  // exception applies.
  if (
    boundaryCheck.needsAIReview
    && aiTopicCheck.verdict !== "clear"
    && aiTopicCheck.verdict !== "caution"
  ) {
    const topics = boundaryCheck.redTopicsWithNote || [];
    await prisma.message.update({
      where: { id: messageId },
      data: { status: "held", heldReason: "red_topic", topicTags: topics },
    });
    return Response.json({ held: true, heldReason: "red_topic", topics, crisis });
  }

  // Previously this passed only the account-wide tone and the gentle topics,
  // so a retried message ignored the relationship, the receiver's extra
  // instructions and their per-connection tone. Same builder as compose now.
  const rephraseSettings = buildRephraseSettings({
    connection,
    receiver,
    connPref: receiverConnPref,
    topicSettings: receiverSettings,
    boundaryCheck,
  });

  const aiResult = await rephraseMessage(message.contentRaw, rephraseSettings);

  if (aiResult.error) {
    const heldReason = aiResult.error === "content_refused" ? "content_refused" : "ai_failed";

    // A refused retry is recorded, not just reported: leaving the row as
    // "ai_failed" would keep offering a retry button for text the provider
    // has already judged, and would count the refusal as an outage.
    if (heldReason !== message.heldReason) {
      await prisma.message.update({
        where: { id: messageId },
        data: { heldReason, aiProvider: aiResult.provider || null },
      });
    }

    return Response.json({
      held: true,
      heldReason,
      error: aiResult.error,
      crisis,
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
    applied: appliedSummary(rephraseSettings),
    crisis,
  });
}
