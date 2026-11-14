import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";

/**
 * The signed-in user's "me on the folks page" header: display info, plus
 * what they have written about themselves.
 *
 * Returned separately from /api/auth/me because the counts and the latest
 * snippets are specific to this one card. The main auth endpoint is called
 * on every page load by AuthGuard, and loading two rows and running two
 * counts there would spread a cost that only the folks page actually
 * needs onto every surface.
 *
 * `latestPost` and `latestEntry` are trimmed to a preview length on the
 * server. Doing it here keeps the payload small and keeps the "what can
 * your folks see" story honest: callers rendering this card never get
 * the full text, only a preview, so a stray render cannot leak the full
 * stored body.
 */

const PREVIEW_LENGTH = 120;

function preview(text) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > PREVIEW_LENGTH
    ? clean.slice(0, PREVIEW_LENGTH - 1).trimEnd() + "…"
    : clean;
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const [postsCount, latestPost, entriesCount, latestEntry, activeConnections] = await Promise.all([
    prisma.wallPost.count({ where: { userId: user.id } }),
    prisma.wallPost.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { text: true, createdAt: true, visibleTo: true, excludedFrom: true },
    }),
    prisma.knowMeEntry.count({ where: { userId: user.id } }),
    prisma.knowMeEntry.findFirst({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }],
      select: { prompt: true, answer: true, isPublic: true, visibleTo: true, excludedFrom: true },
    }),
    prisma.connection.findMany({
      where: { status: "active", OR: [{ userAId: user.id }, { userBId: user.id }] },
      select: { id: true },
    }),
  ]);

  // Audience reach — "visible to N of M folks". Computed over the newest
  // item in each section rather than every one, because a dashboard that
  // says "1 of your 4 posts is hidden from Sam" buries the point: the
  // operator needs one number that answers "is my latest update actually
  // being seen?". For a more detailed per-item view there is /me/audience.
  const activeIds = activeConnections.map((c) => c.id);
  const totalContacts = activeIds.length;

  function reach(item) {
    if (!item) return null;
    if (item.isPublic === false) return 0;
    const addressed =
      !Array.isArray(item.visibleTo) || item.visibleTo.length === 0
        ? activeIds
        : activeIds.filter((id) => item.visibleTo.includes(id));
    const excluded = new Set(item.excludedFrom || []);
    return addressed.filter((id) => !excluded.has(id)).length;
  }


  return Response.json({
    story: {
      count: postsCount,
      latest: latestPost
        ? { text: preview(latestPost.text), createdAt: latestPost.createdAt.toISOString() }
        : null,
      latestReach: reach(latestPost),
    },
    knowMe: {
      count: entriesCount,
      latest: latestEntry
        ? { prompt: preview(latestEntry.prompt), answer: preview(latestEntry.answer) }
        : null,
      latestReach: reach(latestEntry),
    },
    totalContacts,
  });
}
