import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { loadContactsWithBoundaries } from "@/lib/profile-contacts.js";
import { reviewForAudience, canView, textForViewer, pruneVariants } from "@/lib/profile-audience.js";
import prisma from "@/lib/db.js";

// Raised from a tweet-sized 280: these entries are self-description that
// people read on a dedicated page, not a status line squeezed into a card.
const MAX_POST_LENGTH = 1000;
const PAGE_SIZE = 20;

function formatPost(p, isOwner = true) {
  const base = { id: p.id, text: p.text, mood: p.mood, createdAt: p.createdAt };
  if (isOwner) {
    base.visibleTo = p.visibleTo || [];
    base.excludedFrom = p.excludedFrom || [];
    base.variants = p.variants || null;
  }
  return base;
}

/**
 * Re-judge a post against its audience and store who it must be withheld
 * from. Done server-side on every write so the exclusion can't be skipped by
 * a client that doesn't call the check endpoint first.
 */
async function resolveAudience(userId, text, visibleTo, variants) {
  const contacts = await loadContactsWithBoundaries(userId);
  const review = reviewForAudience(text, contacts, visibleTo);
  return {
    review,
    excludedFrom: review.excludedFrom,
    // Drop any variant for someone who can no longer read the post.
    variants: pruneVariants(variants, review.deliverableTo),
  };
}

function sanitizeVariants(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [connectionId, value] of Object.entries(raw)) {
    if (typeof connectionId !== "string" || connectionId.length > 64) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    out[connectionId] = value.trim().slice(0, MAX_POST_LENGTH);
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function getUserConnectionIds(userId) {
  const conns = await prisma.connection.findMany({
    where: { status: "active", OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  return new Set(conns.map((c) => c.id));
}

function sanitizeVisibleTo(raw, validIds) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id) => typeof id === "string" && validIds.has(id));
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  const cursor = searchParams.get("cursor");

  const userId = targetUserId || user.id;

  let connectionForView = null;
  if (targetUserId && targetUserId !== user.id) {
    connectionForView = await prisma.connection.findFirst({
      where: {
        status: "active",
        OR: [
          { userAId: user.id, userBId: targetUserId },
          { userAId: targetUserId, userBId: user.id },
        ],
      },
    });
    if (!connectionForView) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const posts = await prisma.wallPost.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const isOwner = userId === user.id;
  let filtered = posts;
  if (!isOwner && connectionForView) {
    filtered = posts.filter((p) => canView(p, connectionForView.id));
  }

  const hasMore = filtered.length > PAGE_SIZE;
  const page = hasMore ? filtered.slice(0, PAGE_SIZE) : filtered;

  return Response.json({
    posts: page.map((p) => {
      const formatted = formatPost(p, isOwner);
      // A viewer reads the variant the author approved for them, if any.
      if (!isOwner && connectionForView) {
        formatted.text = textForViewer(p, connectionForView.id, "text");
      }
      return formatted;
    }),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const text = typeof body.data.text === "string"
    ? body.data.text.trim().slice(0, MAX_POST_LENGTH)
    : "";

  if (!text) return badRequest("text_required");

  const VALID_MOODS = ["calm", "happy", "energetic", "low", "neutral"];
  const mood = VALID_MOODS.includes(body.data.mood) ? body.data.mood : null;

  const validIds = await getUserConnectionIds(user.id);
  const visibleTo = sanitizeVisibleTo(body.data.visibleTo, validIds);

  const { review, excludedFrom, variants } = await resolveAudience(
    user.id, text, visibleTo, sanitizeVariants(body.data.variants)
  );

  // Storing a note nobody in the audience may read would be a silent no-op,
  // so refuse and let the author retarget or rewrite it.
  if (review.blockedEntirely) {
    return Response.json(
      { error: "blocked_entirely", blocked: review.blocked },
      { status: 400 }
    );
  }

  const post = await prisma.wallPost.create({
    data: { userId: user.id, text, mood, visibleTo, excludedFrom, variants },
  });

  return Response.json({ ...formatPost(post), excluded: review.blocked }, { status: 201 });
}

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const postId = typeof body.data.postId === "string" ? body.data.postId : "";
  if (!postId) return badRequest("postId_required");

  const post = await prisma.wallPost.findUnique({ where: { id: postId } });
  if (!post || post.userId !== user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const data = {};
  if (body.data.visibleTo !== undefined) {
    const validIds = await getUserConnectionIds(user.id);
    data.visibleTo = sanitizeVisibleTo(body.data.visibleTo, validIds);
  }
  if (body.data.text !== undefined) {
    const text = typeof body.data.text === "string"
      ? body.data.text.trim().slice(0, MAX_POST_LENGTH)
      : "";
    if (!text) return badRequest("text_required");
    data.text = text;
  }
  if (body.data.variants !== undefined) {
    data.variants = sanitizeVariants(body.data.variants);
  }

  if (Object.keys(data).length === 0) return badRequest("nothing_to_update");

  // Either a text edit or an audience change can move someone across a
  // boundary, so exclusions are recomputed from the post's resulting state
  // rather than carried over.
  const nextText = data.text ?? post.text;
  const nextVisibleTo = data.visibleTo ?? post.visibleTo ?? [];
  const nextVariants = data.variants !== undefined ? data.variants : post.variants;
  const resolved = await resolveAudience(user.id, nextText, nextVisibleTo, nextVariants);

  if (resolved.review.blockedEntirely) {
    return Response.json(
      { error: "blocked_entirely", blocked: resolved.review.blocked },
      { status: 400 }
    );
  }

  data.excludedFrom = resolved.excludedFrom;
  data.variants = resolved.variants;

  const updated = await prisma.wallPost.update({ where: { id: postId }, data });
  return Response.json({ ...formatPost(updated), excluded: resolved.review.blocked });
}

export async function DELETE(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const postId = typeof body.data.postId === "string" ? body.data.postId : "";
  if (!postId) return badRequest("postId_required");

  const post = await prisma.wallPost.findUnique({ where: { id: postId } });
  if (!post || post.userId !== user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.wallPost.delete({ where: { id: postId } });
  return Response.json({ deleted: postId });
}
