import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const VALID_MOODS = ["calm", "happy", "energetic", "low", "neutral"];

async function activeConnectionIds(userId) {
  const conns = await prisma.connection.findMany({
    where: { status: "active", OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true },
  });
  return new Set(conns.map((c) => c.id));
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    statusText: user.statusText,
    statusMood: user.statusMood,
    statusUpdatedAt: user.statusUpdatedAt,
    statusVisibleTo: user.statusVisibleTo || [],
  });
}

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const text = typeof body.data.statusText === "string"
    ? body.data.statusText.trim().slice(0, 200)
    : null;
  const mood = VALID_MOODS.includes(body.data.statusMood)
    ? body.data.statusMood
    : null;

  const data = {
    statusText: text || null,
    statusMood: mood,
    statusUpdatedAt: new Date(),
  };

  // An unknown connection id in the list would silently hide the status from
  // everyone, so filter against the user's own active connections.
  if (body.data.statusVisibleTo !== undefined) {
    const valid = await activeConnectionIds(user.id);
    data.statusVisibleTo = Array.isArray(body.data.statusVisibleTo)
      ? body.data.statusVisibleTo.filter((v) => typeof v === "string" && valid.has(v))
      : [];
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return Response.json({
    statusText: updated.statusText,
    statusMood: updated.statusMood,
    statusUpdatedAt: updated.statusUpdatedAt,
    statusVisibleTo: updated.statusVisibleTo || [],
  });
}
