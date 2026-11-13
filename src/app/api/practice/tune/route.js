import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { findAccessibleConnection, getPartnerId } from "@/lib/connections.js";
import { checkTopicBoundaries } from "@/lib/topic-checker.js";
import { rephraseMessage } from "@/lib/ai/index.js";
import { getTopicLabel } from "@/lib/topics.js";
import prisma from "@/lib/db.js";

const MAX_DRAFT_LENGTH = 5000;

/**
 * Non-destructive tuner: takes a draft and returns how it would look if
 * tuned for a specific contact. Does NOT persist as a message or send
 * anything. Lets the user try different wordings before committing.
 */
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const draft = requireString(body.data.draft, { maxLength: MAX_DRAFT_LENGTH });
  const connectionId = requireString(body.data.connectionId, { maxLength: 64 });
  if (!draft) return badRequest("missing_draft");

  // When no contact is picked, tune using the user's own general tone
  // preferences — useful for posts or messages to yet-unknown recipients.
  if (!connectionId) {
    const tuned = await rephraseMessage(draft, {
      tonePreference: user.tonePreference,
      locale: user.locale,
    }).catch(() => null);
    if (!tuned) {
      return Response.json({ error: "ai_unavailable" }, { status: 503 });
    }
    return Response.json({ tuned, held: false, flagged: [] });
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

  const boundaryCheck = checkTopicBoundaries(draft, receiverSettings);
  const flagged = (boundaryCheck.redTopics || []).map((t) => ({ topic: t, level: "red" }))
    .concat((boundaryCheck.yellowTopics || []).map((t) => ({ topic: t, level: "yellow" })));

  if (!boundaryCheck.allowed) {
    return Response.json({
      tuned: null,
      held: true,
      heldReason: boundaryCheck.heldReason,
      flagged,
    });
  }

  const topicNotes = receiverSettings
    .filter((s) => s.note && s.comfortLevel !== "green")
    .map((s) => ({
      topic: s.sanitizedLabel || getTopicLabel(s.topicName) || s.topicName,
      note: s.note,
    }));

  const tuned = await rephraseMessage(draft, {
    tonePreference: receiverConnPref?.tonePreference || receiver?.tonePreference,
    tonePrompt: receiverConnPref?.tonePrompt,
    relationshipType: connection.relationshipType,
    yellowTopics: boundaryCheck.yellowTopics || [],
    topicNotes,
    locale: receiver?.locale,
  }).catch(() => null);

  if (!tuned) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }

  return Response.json({ tuned, held: false, flagged });
}
