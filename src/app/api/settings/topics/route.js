import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { findAccessibleConnection } from "@/lib/connections.js";
import {
  TOPIC_KEYS,
  isValidTopicKey,
  getTopicLabel,
  isCustomTopicKey,
  sanitizeCustomTopic,
  MAX_CUSTOM_TOPICS,
} from "@/lib/topics.js";
import prisma from "@/lib/db.js";

const VALID_COMFORT_LEVELS = ["green", "yellow", "red"];

/**
 * Topic boundaries live in two scopes, which this route treats uniformly:
 * with a connectionId, rows are that pair's settings (TopicSetting); without
 * one, rows are the user's pre-connection defaults (TopicDefault), copied to
 * every connection the moment it activates. The UI can therefore let someone
 * set boundaries before anyone has accepted anything.
 */

async function resolveScope(user, connectionId) {
  if (!connectionId) {
    return { model: prisma.topicDefault, where: { userId: user.id }, connection: null };
  }
  const connection = await findAccessibleConnection(user.id, connectionId, {
    requireActive: false,
  });
  if (!connection) return null;
  return {
    model: prisma.topicSetting,
    where: { connectionId, userId: user.id },
    connection,
  };
}

function formatRows(stored) {
  const byTopic = Object.fromEntries(stored.map((s) => [s.topicName, s]));

  const presets = TOPIC_KEYS.map((key) => ({
    topicName: key,
    label: getTopicLabel(key),
    comfortLevel: byTopic[key]?.comfortLevel || "green",
    note: byTopic[key]?.note || "",
    isCustom: false,
    id: byTopic[key]?.id || null,
  }));

  const customs = stored
    .filter((s) => isCustomTopicKey(s.topicName))
    .map((s) => ({
      topicName: s.topicName,
      label: s.sanitizedLabel || s.topicName,
      comfortLevel: s.comfortLevel,
      note: s.note || "",
      isCustom: true,
      id: s.id,
    }));

  return [...presets, ...customs];
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope = await resolveScope(user, searchParams.get("connectionId"));
  if (!scope) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const stored = await scope.model.findMany({ where: scope.where });
  return Response.json({ settings: formatRows(stored), presetTopics: TOPIC_KEYS });
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
  const customLabel = requireString(body.data.customLabel, { maxLength: 64 });
  let topicName = requireString(body.data.topicName, { maxLength: 64 });
  const { comfortLevel } = body.data;
  const noteRaw = typeof body.data.note === "string" ? body.data.note.slice(0, 200) : null;

  if (!comfortLevel || !VALID_COMFORT_LEVELS.includes(comfortLevel)) {
    return badRequest("invalid_comfort_level");
  }

  const scope = await resolveScope(user, connectionId);
  if (!scope) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let sanitizedLabel = null;
  let isCustom = false;

  if (customLabel) {
    const custom = sanitizeCustomTopic(customLabel);
    if (!custom.ok) {
      return Response.json({ error: "invalid_custom_topic", detail: custom.error }, { status: 400 });
    }
    topicName = custom.key;
    sanitizedLabel = custom.label;
    isCustom = true;

    const existingCustoms = await scope.model.count({
      where: { ...scope.where, isCustom: true },
    });
    const already = await scope.model.findFirst({ where: { ...scope.where, topicName } });
    if (!already && existingCustoms >= MAX_CUSTOM_TOPICS) {
      return Response.json(
        { error: "too_many_custom_topics", detail: `You can have up to ${MAX_CUSTOM_TOPICS} custom topics — remove one first.` },
        { status: 400 }
      );
    }
  } else if (!topicName) {
    return badRequest("missing_fields");
  } else if (isCustomTopicKey(topicName)) {
    // Setting the level of a custom topic that must already exist in this
    // scope — the label (and so the keywords) came from its creation.
    const existing = await scope.model.findFirst({ where: { ...scope.where, topicName } });
    if (!existing) {
      return badRequest("unknown_topic");
    }
    sanitizedLabel = existing.sanitizedLabel;
    isCustom = true;
  } else if (!isValidTopicKey(topicName)) {
    // A boundary is only accepted if it can actually be enforced. Storing an
    // unknown topic would record a Red setting the checker silently ignores.
    return badRequest("unknown_topic");
  }

  const uniqueWhere = scope.connection
    ? { connectionId_userId_topicName: { connectionId: scope.connection.id, userId: user.id, topicName } }
    : { userId_topicName: { userId: user.id, topicName } };

  // Notes only apply to per-connection TopicSetting rows; TopicDefault has no
  // note column because defaults are pre-connection and can't target a person.
  const noteUpdate = scope.connection && noteRaw !== null
    ? { note: noteRaw.trim() || null }
    : {};

  const setting = await scope.model.upsert({
    where: uniqueWhere,
    update: { comfortLevel, ...(sanitizedLabel ? { sanitizedLabel, isCustom } : {}), ...noteUpdate },
    create: {
      ...(scope.connection ? { connectionId: scope.connection.id } : {}),
      userId: user.id,
      topicName,
      comfortLevel,
      isCustom,
      sanitizedLabel,
      ...noteUpdate,
    },
  });

  return Response.json({
    id: setting.id,
    topicName: setting.topicName,
    label: setting.sanitizedLabel || getTopicLabel(setting.topicName),
    comfortLevel: setting.comfortLevel,
    note: setting.note || "",
    isCustom: setting.isCustom,
  });
}

export async function DELETE(request) {
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

  // Presets cannot be deleted, only set back to green — deleting one would
  // just make GET re-create it at green anyway.
  if (!topicName || !isCustomTopicKey(topicName)) {
    return badRequest("not_a_custom_topic");
  }

  const scope = await resolveScope(user, connectionId);
  if (!scope) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await scope.model.deleteMany({ where: { ...scope.where, topicName } });
  return Response.json({ deleted: topicName });
}
