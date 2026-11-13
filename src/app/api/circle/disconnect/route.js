import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const connectionId = requireString(body.data.connectionId, { maxLength: 64 });
  if (!connectionId) {
    return badRequest("missing_connectionId");
  }

  const connection = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });

  if (!connection) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Cascade cleanup: per-connection prefs, topic settings, and messages must
  // go when the connection is severed, otherwise rejoining later would inherit
  // stale settings from a prior relationship.
  await prisma.$transaction([
    prisma.connectionPreference.deleteMany({ where: { connectionId } }),
    prisma.topicSetting.deleteMany({ where: { connectionId } }),
    prisma.message.deleteMany({ where: { connectionId } }),
    prisma.connection.delete({ where: { id: connectionId } }),
  ]);

  return Response.json({ disconnected: connectionId });
}
