import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { findAccessibleConnection } from "@/lib/connections.js";
import { TOPIC_KEYS, isValidTopicKey, getTopicLabel } from "@/lib/topics.js";
import prisma from "@/lib/db.js";

const VALID_COMFORT_LEVELS = ["green", "yellow", "red"];

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");

  if (!connectionId) {
    return badRequest("missing_connectionId");
  }

  const connection = await findAccessibleConnection(user.id, connectionId, {
    requireActive: false,
  });
  if (!connection) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const stored = await prisma.topicSetting.findMany({
    where: { connectionId, userId: user.id },
  });
  const byTopic = Object.fromEntries(stored.map((s) => [s.topicName, s]));

  const settings = TOPIC_KEYS.map((key) => ({
    topicName: key,
    label: getTopicLabel(key),
    comfortLevel: byTopic[key]?.comfortLevel || "green",
    id: byTopic[key]?.id || null,
  }));

  return Response.json({ settings, presetTopics: TOPIC_KEYS });
}

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const connectionId = requireString(body.data.connectionId, { maxLength: 64 });
  const topicName = requireString(body.data.topicName, { maxLength: 64 });
  const { comfortLevel } = body.data;

  if (!connectionId || !topicName || !comfortLevel) {
    return badRequest("missing_fields");
  }

  if (!VALID_COMFORT_LEVELS.includes(comfortLevel)) {
    return badRequest("invalid_comfort_level");
  }

  // A boundary is only accepted if it can actually be enforced. Storing an
  // unknown topic would record a Red setting the checker silently ignores and
  // GET never shows back — the user would believe it was active.
  if (!isValidTopicKey(topicName)) {
    return badRequest("unknown_topic");
  }

  const connection = await findAccessibleConnection(user.id, connectionId, {
    requireActive: false,
  });
  if (!connection) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const setting = await prisma.topicSetting.upsert({
    where: {
      connectionId_userId_topicName: { connectionId, userId: user.id, topicName },
    },
    update: { comfortLevel },
    create: { connectionId, userId: user.id, topicName, comfortLevel },
  });

  return Response.json({
    id: setting.id,
    topicName: setting.topicName,
    comfortLevel: setting.comfortLevel,
  });
}
