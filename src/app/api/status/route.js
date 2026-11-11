import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const VALID_MOODS = ["calm", "happy", "energetic", "low", "neutral"];

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    statusText: user.statusText,
    statusMood: user.statusMood,
    statusUpdatedAt: user.statusUpdatedAt,
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      statusText: text || null,
      statusMood: mood,
      statusUpdatedAt: new Date(),
    },
  });

  return Response.json({
    statusText: updated.statusText,
    statusMood: updated.statusMood,
    statusUpdatedAt: updated.statusUpdatedAt,
  });
}
