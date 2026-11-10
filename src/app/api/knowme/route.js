import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const CATEGORIES = ["about_me", "favorites", "love_languages", "pet_peeves", "stories"];
const MAX_ENTRIES = 30;

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId") || user.id;

  if (targetUserId !== user.id) {
    const conn = await prisma.connection.findFirst({
      where: {
        status: "active",
        OR: [
          { userAId: user.id, userBId: targetUserId },
          { userAId: targetUserId, userBId: user.id },
        ],
      },
    });
    if (!conn) {
      return Response.json({ error: "not_connected" }, { status: 403 });
    }
  }

  const entries = await prisma.knowMeEntry.findMany({
    where: {
      userId: targetUserId,
      ...(targetUserId !== user.id ? { isPublic: true } : {}),
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return Response.json({ entries, categories: CATEGORIES });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const { category, prompt, answer, isPublic = true } = body.data;

  if (!CATEGORIES.includes(category)) return badRequest("invalid_category");
  if (!prompt || typeof prompt !== "string" || prompt.length > 200) return badRequest("invalid_prompt");
  if (!answer || typeof answer !== "string" || answer.length > 2000) return badRequest("invalid_answer");

  const count = await prisma.knowMeEntry.count({ where: { userId: user.id } });
  if (count >= MAX_ENTRIES) {
    return Response.json({ error: "limit_reached", detail: `Maximum ${MAX_ENTRIES} entries.` }, { status: 400 });
  }

  const entry = await prisma.knowMeEntry.create({
    data: {
      userId: user.id,
      category,
      prompt,
      answer,
      isPublic: Boolean(isPublic),
      sortOrder: count,
    },
  });

  return Response.json({ entry }, { status: 201 });
}

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const { id, answer, isPublic } = body.data;
  if (!id) return badRequest("missing_id");

  const entry = await prisma.knowMeEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const data = {};
  if (answer !== undefined) {
    if (typeof answer !== "string" || answer.length > 2000) return badRequest("invalid_answer");
    data.answer = answer;
  }
  if (isPublic !== undefined) data.isPublic = Boolean(isPublic);

  const updated = await prisma.knowMeEntry.update({ where: { id }, data });
  return Response.json({ entry: updated });
}

export async function DELETE(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const { id } = body.data;
  if (!id) return badRequest("missing_id");

  const entry = await prisma.knowMeEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.knowMeEntry.delete({ where: { id } });
  return Response.json({ deleted: true });
}
