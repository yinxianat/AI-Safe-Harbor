import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const MAX_POST_LENGTH = 280;
const PAGE_SIZE = 20;

function formatPost(p, isOwner = true) {
  const base = { id: p.id, text: p.text, mood: p.mood, createdAt: p.createdAt };
  if (isOwner) base.visibleTo = p.visibleTo || [];
  return base;
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
    filtered = posts.filter(
      (p) => !p.visibleTo || p.visibleTo.length === 0 || p.visibleTo.includes(connectionForView.id)
    );
  }

  const hasMore = filtered.length > PAGE_SIZE;
  const page = hasMore ? filtered.slice(0, PAGE_SIZE) : filtered;

  return Response.json({
    posts: page.map((p) => formatPost(p, isOwner)),
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

  const post = await prisma.wallPost.create({
    data: { userId: user.id, text, mood, visibleTo },
  });

  return Response.json(formatPost(post), { status: 201 });
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

  if (Object.keys(data).length === 0) return badRequest("nothing_to_update");

  const updated = await prisma.wallPost.update({ where: { id: postId }, data });
  return Response.json(formatPost(updated));
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
