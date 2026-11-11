import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const MAX_POST_LENGTH = 280;
const PAGE_SIZE = 20;

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  const cursor = searchParams.get("cursor");

  const userId = targetUserId || user.id;

  if (targetUserId && targetUserId !== user.id) {
    const connection = await prisma.connection.findFirst({
      where: {
        status: "active",
        OR: [
          { userAId: user.id, userBId: targetUserId },
          { userAId: targetUserId, userBId: user.id },
        ],
      },
    });
    if (!connection) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const posts = await prisma.wallPost.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = posts.length > PAGE_SIZE;
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return Response.json({
    posts: page.map((p) => ({
      id: p.id,
      text: p.text,
      mood: p.mood,
      createdAt: p.createdAt,
    })),
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

  const post = await prisma.wallPost.create({
    data: { userId: user.id, text, mood },
  });

  return Response.json({
    id: post.id,
    text: post.text,
    mood: post.mood,
    createdAt: post.createdAt,
  }, { status: 201 });
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
