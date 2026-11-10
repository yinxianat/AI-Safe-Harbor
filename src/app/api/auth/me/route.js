import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    id: user.id,
    email: user.email,
    username: user.username || null,
    displayName: user.displayName,
    timezone: user.timezone,
  });
}

export async function PATCH(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const updates = {};

  if (body.data.displayName !== undefined) {
    const name = requireString(body.data.displayName, { maxLength: 50 });
    updates.displayName = name || null;
  }

  if (body.data.timezone !== undefined) {
    const tz = requireString(body.data.timezone, { maxLength: 50 });
    if (tz) updates.timezone = tz;
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("nothing_to_update");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
  });

  return Response.json({
    id: updated.id,
    email: updated.email,
    username: updated.username || null,
    displayName: updated.displayName,
    timezone: updated.timezone,
  });
}
