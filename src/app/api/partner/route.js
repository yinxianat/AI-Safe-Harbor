import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";
import { TOPIC_KEYS, getTopicLabel, isCustomTopicKey } from "@/lib/topics.js";

const VALID_TONES = {
  warm_and_gentle: "Warm & gentle",
  direct_and_clear: "Direct & clear",
  playful_and_light: "Playful & light",
  calm_and_neutral: "Calm & neutral",
  encouraging_and_supportive: "Encouraging & supportive",
  brief_and_to_the_point: "Brief & to the point",
  thoughtful_and_reflective: "Thoughtful & reflective",
  reassuring_and_patient: "Reassuring & patient",
};

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

  const connection = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      status: "active",
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });

  if (!connection) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const partnerId = connection.userAId === user.id ? connection.userBId : connection.userAId;

  const [partner, partnerSettings, knowMeEntries, wallPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: partnerId },
      select: {
        id: true, displayName: true, username: true, tonePreference: true,
        statusText: true, statusMood: true, statusUpdatedAt: true,
      },
    }),
    prisma.topicSetting.findMany({
      where: { connectionId, userId: partnerId },
    }),
    prisma.knowMeEntry.findMany({
      where: { userId: partnerId, isPublic: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.wallPost.findMany({
      where: { userId: partnerId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!partner) {
    return Response.json({ error: "partner_not_found" }, { status: 404 });
  }

  const settingsByTopic = Object.fromEntries(
    partnerSettings.map((s) => [s.topicName, s])
  );

  const boundaries = TOPIC_KEYS.map((key) => ({
    topicName: key,
    label: getTopicLabel(key),
    comfortLevel: settingsByTopic[key]?.comfortLevel || "green",
    isCustom: false,
  }));

  const customBoundaries = partnerSettings
    .filter((s) => isCustomTopicKey(s.topicName))
    .map((s) => ({
      topicName: s.topicName,
      label: s.sanitizedLabel || s.topicName,
      comfortLevel: s.comfortLevel,
      isCustom: true,
    }));

  const entries = knowMeEntries.map((e) => ({
    id: e.id,
    category: e.category,
    prompt: e.prompt,
    answer: e.answer,
  }));

  return Response.json({
    partner: {
      id: partner.id,
      displayName: partner.displayName,
      username: partner.username,
      tonePreference: partner.tonePreference,
      toneLabel: VALID_TONES[partner.tonePreference] || partner.tonePreference,
      statusText: partner.statusText,
      statusMood: partner.statusMood,
      statusUpdatedAt: partner.statusUpdatedAt,
    },
    boundaries: [...boundaries, ...customBoundaries],
    knowMe: entries,
    wall: wallPosts.map((p) => ({
      id: p.id,
      text: p.text,
      mood: p.mood,
      createdAt: p.createdAt,
    })),
  });
}
