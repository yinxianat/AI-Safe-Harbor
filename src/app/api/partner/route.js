import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";
import { TOPIC_KEYS, getTopicLabel, isCustomTopicKey } from "@/lib/topics.js";
import { canView, textForViewer } from "@/lib/profile-audience.js";
import { shieldText, shieldTexts } from "@/lib/ai/apply-shield.js";
import { toneLabelKey } from "@/lib/tones.js";

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
        avatarUrl: true,
        statusText: true, statusMood: true, statusUpdatedAt: true,
        statusVisibleTo: true,
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

  // visibleTo is an allow-list when set; excludedFrom (a red-topic boundary
  // this viewer declared) always wins.
  const visibleWall = wallPosts.filter((p) => canView(p, connectionId));
  const visibleKnowMe = knowMeEntries.filter((e) => canView(e, connectionId));

  // The status follows the same per-connection rule as posts and entries.
  const statusVisible =
    !partner.statusVisibleTo ||
    partner.statusVisibleTo.length === 0 ||
    partner.statusVisibleTo.includes(connectionId);

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

  // The viewer's own stored shield decides which emotions are softened
  // before they see this page. shieldText / shieldTexts fail OPEN — a
  // provider outage returns the original text, so a down AI never silences
  // the partner.
  const knowMeAnswers = visibleKnowMe.map((e) => textForViewer(e, connectionId, "answer"));
  const wallTexts = visibleWall.map((p) => textForViewer(p, connectionId, "text"));

  const [statusShielded, knowMeShielded, wallShielded] = await Promise.all([
    statusVisible && partner.statusText
      ? shieldText(user, partner.statusText)
      : { text: statusVisible ? partner.statusText : null, softened: false },
    shieldTexts(user, knowMeAnswers),
    shieldTexts(user, wallTexts),
  ]);

  const entries = visibleKnowMe.map((e, i) => ({
    id: e.id,
    category: e.category,
    prompt: e.prompt,
    answer: knowMeShielded[i].text,
    softened: knowMeShielded[i].softened,
  }));

  return Response.json({
    partner: {
      id: partner.id,
      displayName: partner.displayName,
      username: partner.username,
      tonePreference: partner.tonePreference,
      toneLabelKey: toneLabelKey(partner.tonePreference),
      avatarUrl: partner.avatarUrl || null,
      statusText: statusShielded.text,
      statusMood: statusVisible ? partner.statusMood : null,
      statusUpdatedAt: statusVisible ? partner.statusUpdatedAt : null,
      statusSoftened: statusShielded.softened,
    },
    boundaries: [...boundaries, ...customBoundaries],
    knowMe: entries,
    wall: visibleWall.map((p, i) => ({
      id: p.id,
      text: wallShielded[i].text,
      mood: p.mood,
      createdAt: p.createdAt,
      softened: wallShielded[i].softened,
    })),
    // Did the reader's shield change anything on this page? The UI uses
    // this to say "softened for you" once, rather than a badge per item.
    shieldApplied:
      statusShielded.softened
      || knowMeShielded.some((e) => e.softened)
      || wallShielded.some((e) => e.softened),
  });
}
