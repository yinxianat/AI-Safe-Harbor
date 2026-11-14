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

  const [postsCount, latestPost, entriesCount, latestEntry] = await Promise.all([
    prisma.wallPost.count({ where: { userId: user.id } }),
    prisma.wallPost.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { text: true, createdAt: true },
    }),
    prisma.knowMeEntry.count({ where: { userId: user.id } }),
    // Latest-touched Know Me entry: people revise these far more than they
    // add new ones, and the last-touched one is what they'll remember
    // writing. KnowMeEntry has no updatedAt, so createdAt is the proxy.
    prisma.knowMeEntry.findFirst({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }],
      select: { prompt: true, answer: true },
    }),
  ]);

  return Response.json({
    story: {
      count: postsCount,
      latest: latestPost
        ? { text: preview(latestPost.text), createdAt: latestPost.createdAt.toISOString() }
        : null,
    },
    knowMe: {
      count: entriesCount,
      // The prompt and the answer together say what the entry is about,
      // but the answer is the part that varies — a card without the
      // prompt reads as fragment, not a snippet.
      latest: latestEntry
        ? { prompt: preview(latestEntry.prompt), answer: preview(latestEntry.answer) }
        : null,
    },
  });
}
