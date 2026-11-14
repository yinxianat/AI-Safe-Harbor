import { getSessionUser } from "@/lib/auth.js";
import prisma from "@/lib/db.js";
import { canView, textForViewer } from "@/lib/profile-audience.js";

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
const STATUS_WINDOW_DAYS = 14;

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
    where: { userId: { in: authorIds } },
    orderBy: { createdAt: "desc" },
    // Capped per author inside the client code to keep one chatty author
    // from crowding the feed. Over-fetch, then slice.
    take: POSTS_PER_AUTHOR * authorIds.length,
  });

  const items = [];

  // Status updates first, so a recent status always has a shot at the top of
  // the feed even when one contact has posted a lot of notes today.
  const sinceStatus = Date.now() - STATUS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  for (const meta of authorMeta.values()) {
    if (!meta.statusText || !meta.statusUpdatedAt) continue;
    if (meta.statusUpdatedAt.getTime() < sinceStatus) continue;
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
    });
  }

  const perAuthor = new Map();
  for (const post of posts) {
    const meta = authorMeta.get(post.userId);
    if (!meta) continue;
    if (!canView(post, meta.connectionId)) continue;

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
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return Response.json({ items: items.slice(0, FEED_LIMIT) });
}
