import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const CATEGORIES = ["about_me", "favorites", "love_languages", "pet_peeves", "stories"];
const MAX_ENTRIES = 30;

async function getUserConnectionIds(userId) {
  const conns = await prisma.connection.findMany({
    where: { status: "active", OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  return new Set(conns.map((c) => c.id));
}

function sanitizeVisibleTo(raw, validIds) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => typeof v === "string" && validIds.has(v));
}

function formatEntry(e, isOwner = true) {
  const base = { id: e.id, category: e.category, prompt: e.prompt, answer: e.answer, isPublic: e.isPublic, sortOrder: e.sortOrder, createdAt: e.createdAt };
  if (isOwner) base.visibleTo = e.visibleTo || [];
  return base;
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId") || user.id;

  let connectionForView = null;
  if (targetUserId !== user.id) {
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

  const isOwner = targetUserId === user.id;
  let visible = entries;
  if (!isOwner && connectionForView) {
    visible = entries.filter(
      (e) => !e.visibleTo || e.visibleTo.length === 0 || e.visibleTo.includes(connectionForView.id)
    );
  }

  return Response.json({ entries: visible.map((e) => formatEntry(e, isOwner)), categories: CATEGORIES });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const { category, prompt, answer, isPublic = true, visibleTo } = body.data;

  // Category is no longer asked for in the UI; accept a known one if the
  // caller sends it and otherwise fall back to the default bucket.
  const resolvedCategory = CATEGORIES.includes(category) ? category : "about_me";
  if (!prompt || typeof prompt !== "string" || prompt.length > 200) return badRequest("invalid_prompt");
  if (!answer || typeof answer !== "string" || answer.length > 2000) return badRequest("invalid_answer");

  const count = await prisma.knowMeEntry.count({ where: { userId: user.id } });
  if (count >= MAX_ENTRIES) {
    return Response.json({ error: "limit_reached", detail: `Maximum ${MAX_ENTRIES} entries.` }, { status: 400 });
  }

  const validIds = await getUserConnectionIds(user.id);
  const sanitizedVisibleTo = sanitizeVisibleTo(visibleTo, validIds);

  const entry = await prisma.knowMeEntry.create({
    data: {
      userId: user.id,
      category: resolvedCategory,
      prompt,
      answer,
      isPublic: Boolean(isPublic),
      visibleTo: sanitizedVisibleTo,
      sortOrder: count,
    },
  });

  return Response.json({ entry: formatEntry(entry) }, { status: 201 });
}

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const { id, prompt, answer, isPublic, visibleTo } = body.data;
  if (!id) return badRequest("missing_id");

  const entry = await prisma.knowMeEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== user.id) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const data = {};
  if (prompt !== undefined) {
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 200) {
      return badRequest("invalid_prompt");
    }
    data.prompt = prompt.trim();
  }
  if (answer !== undefined) {
    if (typeof answer !== "string" || answer.length > 2000) return badRequest("invalid_answer");
    data.answer = answer;
  }
  if (isPublic !== undefined) data.isPublic = Boolean(isPublic);
  if (visibleTo !== undefined) {
    const validIds = await getUserConnectionIds(user.id);
    data.visibleTo = sanitizeVisibleTo(visibleTo, validIds);
  }

  const updated = await prisma.knowMeEntry.update({ where: { id }, data });
  return Response.json({ entry: formatEntry(updated) });
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
