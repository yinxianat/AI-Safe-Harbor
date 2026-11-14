import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";
import { canView, textForViewer } from "@/lib/profile-audience.js";
import { shieldTexts } from "@/lib/ai/apply-shield.js";

/**
 * A reverse-chronological feed of what every active contact has posted and
 * how their status has changed, as seen through each of their own audience
 * settings — never a global broadcast.
 *
 * One mixed stream rather than one list per author, because the Folks page
 * is answering "what have the people I care about been up to lately", and
 * two lists per contact would hide a recent status update behind a card's
 * second screen.
 *
 * Each item carries the connectionId its visibility was decided on, so the
 * caller can honour every per-connection rule the authoring routes already
 * enforce: a post hidden from this specific connection stays hidden here.
 */

const FEED_LIMIT = 40;
const POSTS_PER_AUTHOR = 10;
// Matching windows close the gap flagged in the folks-page brainstorm: a
// status from today used to compete with a post from months ago on the
// same screen, which made "recent updates" a misleading section title.
const FEED_WINDOW_DAYS = 30;
// Anything older than this is marked as a rediscovery card, so the UI
// can show a "from a while back" chip and users don't think the other
// person just posted it.
const REDISCOVERY_DAYS = 7;

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await prisma.connection.findMany({
    where: { status: "active", OR: [{ userAId: user.id }, { userBId: user.id }] },
    include: {
      userA: {
        select: {
          id: true, displayName: true, username: true, avatarUrl: true,
          statusText: true, statusUpdatedAt: true, statusVisibleTo: true,
        },
      },
      userB: {
        select: {
          id: true, displayName: true, username: true, avatarUrl: true,
          statusText: true, statusUpdatedAt: true, statusVisibleTo: true,
        },
      },
      preferences: {
        where: { userId: user.id },
        select: { nickname: true },
      },
    },
  });

  if (connections.length === 0) {
    return Response.json({ items: [] });
  }

  // Build author metadata once, keyed by the author's user id, because the
  // post query returns rows by userId and the connection-level visibility
  // check needs to be done against this reader's connection to that author.
  const authorMeta = new Map();
  for (const c of connections) {
    const partner = c.userAId === user.id ? c.userB : c.userA;
    const myPref = c.preferences?.[0];
    authorMeta.set(partner.id, {
      connectionId: c.id,
      author: {
        id: partner.id,
        name: myPref?.nickname
          || partner.displayName
          || (partner.username ? `@${partner.username}` : null),
        avatarUrl: partner.avatarUrl || null,
      },
      statusVisibleTo: partner.statusVisibleTo || [],
      statusText: partner.statusText,
      statusUpdatedAt: partner.statusUpdatedAt,
    });
  }

  const authorIds = [...authorMeta.keys()];

  const posts = await prisma.wallPost.findMany({
    where: {
      userId: { in: authorIds },
      createdAt: { gte: new Date(windowStart) },
    },
    orderBy: { createdAt: "desc" },
    // Capped per author inside the client code to keep one chatty author
    // from crowding the feed. Over-fetch, then slice.
    take: POSTS_PER_AUTHOR * authorIds.length,
  });

  const items = [];

  // Status updates first, so a recent status always has a shot at the top of
  // the feed even when one contact has posted a lot of notes today.
  const windowStart = Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const rediscoveryStart = Date.now() - REDISCOVERY_DAYS * 24 * 60 * 60 * 1000;
  for (const meta of authorMeta.values()) {
    if (!meta.statusText || !meta.statusUpdatedAt) continue;
    if (meta.statusUpdatedAt.getTime() < windowStart) continue;
    const visible =
      meta.statusVisibleTo.length === 0 ||
      meta.statusVisibleTo.includes(meta.connectionId);
    if (!visible) continue;
    items.push({
      kind: "status",
      id: `status:${meta.author.id}:${meta.statusUpdatedAt.toISOString()}`,
      author: meta.author,
      connectionId: meta.connectionId,
      text: meta.statusText,
      createdAt: meta.statusUpdatedAt.toISOString(),
      isRediscovery: meta.statusUpdatedAt.getTime() < rediscoveryStart,
    });
  }

  const perAuthor = new Map();
  for (const post of posts) {
    const meta = authorMeta.get(post.userId);
    if (!meta) continue;
    if (!canView(post, meta.connectionId)) continue;
    if (post.createdAt.getTime() < windowStart) continue;

    const count = perAuthor.get(post.userId) || 0;
    if (count >= POSTS_PER_AUTHOR) continue;
    perAuthor.set(post.userId, count + 1);

    items.push({
      kind: "post",
      id: `post:${post.id}`,
      author: meta.author,
      connectionId: meta.connectionId,
      text: textForViewer(post, meta.connectionId, "text"),
      mood: post.mood,
      createdAt: post.createdAt.toISOString(),
      isRediscovery: post.createdAt.getTime() < rediscoveryStart,
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Rediscovery: when the feed is thin, surface older Know Me entries as
  // "from a while back" cards. The product's small-graph trap is that
  // "recent updates" can be empty for weeks — a quiet day looks like the
  // other person has vanished. Facebook calls this surface Memories; the
  // intent here is the same but scoped to what the OTHER person has
  // actually written about themselves, never generated.
  const THIN = 6;
  if (items.length < THIN && authorIds.length > 0) {
    const older = await prisma.knowMeEntry.findMany({
      where: { userId: { in: authorIds }, isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const need = THIN - items.length;
    const perAuthorKM = new Map();
    for (const e of older) {
      if (items.length >= THIN) break;
      const meta = authorMeta.get(e.userId);
      if (!meta) continue;
      if (!canView(e, meta.connectionId)) continue;
      const taken = perAuthorKM.get(e.userId) || 0;
      // At most one rediscovery card per author, so a chatty author
      // does not swamp a thin feed.
      if (taken >= 1) continue;
      perAuthorKM.set(e.userId, taken + 1);
      items.push({
        kind: "rediscovery",
        id: `rediscovery:${e.id}`,
        author: meta.author,
        connectionId: meta.connectionId,
        text: `${e.prompt} — ${e.answer}`,
        createdAt: e.createdAt.toISOString(),
        isRediscovery: true,
      });
      if (perAuthorKM.size >= need) {
        // Keep going to try other authors, bail only once we've reached
        // the target count.
        if (items.length >= THIN) break;
      }
    }
  }

  const capped = items.slice(0, FEED_LIMIT);

  // Soften each item's text with the reader's own shield. Falls through
  // to the original on any failure; items with no softening to do return
  // their text unchanged with softened=false.
  const shielded = await shieldTexts(user, capped.map((i) => i.text));
  const withShield = capped.map((item, i) => ({
    ...item,
    text: shielded[i].text,
    softened: shielded[i].softened,
  }));

  return Response.json({
    items: withShield,
    shieldApplied: shielded.some((s) => s.softened),
  });
}
