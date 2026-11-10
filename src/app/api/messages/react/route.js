import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { isValidReaction } from "@/lib/reactions.js";
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

  const messageId = requireString(body.data.messageId, { maxLength: 64 });
  const reaction = body.data.reaction ?? null;
  if (!messageId) {
    return badRequest("missing_messageId");
  }
  if (reaction !== null && !isValidReaction(reaction)) {
    return badRequest("invalid_reaction");
  }

  // Only the receiver of a delivered message may react: the message's
  // connection must include this user, and they must not be the sender.
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { connection: { select: { userAId: true, userBId: true } } },
  });

  const isParticipant =
    message &&
    (message.connection.userAId === user.id || message.connection.userBId === user.id);
  if (!message || !isParticipant || message.senderId === user.id || message.status !== "sent") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { reaction, reactedAt: reaction ? new Date() : null },
  });

  return Response.json({ id: updated.id, reaction: updated.reaction });
}
