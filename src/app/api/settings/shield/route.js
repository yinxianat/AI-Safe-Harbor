import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { sanitizeEmotions, EMOTION_KEYS, DEFAULT_SHIELD_EMOTIONS } from "@/lib/emotions.js";
import prisma from "@/lib/db.js";

/**
 * The reader-side emotional shield settings.
 *
 * Returns the full catalog of emotions each time so a client can render
 * the picker without a separate round-trip. The user's own list is the
 * subset they have enabled.
 */

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    enabled: user.emotionalShield !== false,
    emotions: user.emotionalShieldEmotions || DEFAULT_SHIELD_EMOTIONS,
    allEmotions: EMOTION_KEYS,
  });
}

/**
 * PUT accepts either an on/off flip or a new emotion list, or both. When
 * an emotion list is sent, it is sanitized against the registry — a key
 * that has been removed from the registry is silently dropped rather
 * than stored with a dead reference.
 */
export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const data = {};
  if (typeof body.data.enabled === "boolean") {
    data.emotionalShield = body.data.enabled;
  }
  if (body.data.emotions !== undefined) {
    data.emotionalShieldEmotions = sanitizeEmotions(body.data.emotions);
  }
  if (Object.keys(data).length === 0) return badRequest("nothing_to_update");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { emotionalShield: true, emotionalShieldEmotions: true },
  });

  return Response.json({
    enabled: updated.emotionalShield,
    emotions: updated.emotionalShieldEmotions,
    allEmotions: EMOTION_KEYS,
  });
}
