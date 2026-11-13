import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
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

  // Require typed confirmation so a stray tap in the settings menu cannot wipe
  // someone's account. The literal string matches the UI prompt exactly.
  if (body.data.confirm !== "DELETE") {
    return badRequest("confirmation_required");
  }

  const connections = await prisma.connection.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    select: { id: true },
  });
  const connectionIds = connections.map((c) => c.id);

  await prisma.$transaction([
    prisma.connectionPreference.deleteMany({ where: { userId: user.id } }),
    prisma.topicSetting.deleteMany({ where: { userId: user.id } }),
    prisma.topicDefault.deleteMany({ where: { userId: user.id } }),
    prisma.message.deleteMany({ where: { senderId: user.id } }),
    prisma.message.deleteMany({ where: { connectionId: { in: connectionIds } } }),
    prisma.wallPost.deleteMany({ where: { userId: user.id } }),
    prisma.knowMeEntry.deleteMany({ where: { userId: user.id } }),
    prisma.practiceSession.deleteMany({ where: { userId: user.id } }),
    prisma.magicToken.deleteMany({ where: { OR: [{ userId: user.id }, { invitedByUserId: user.id }] } }),
    prisma.connection.deleteMany({ where: { id: { in: connectionIds } } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  const response = Response.json({ deleted: true });
  response.headers.set(
    "Set-Cookie",
    "session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax"
  );
  return response;
}
