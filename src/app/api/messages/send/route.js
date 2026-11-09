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

  const messageId = requireString(body.data.messageId, { maxLength: 64 });
  if (!messageId) {
    return badRequest("missing_messageId");
  }

  // Only the rephrased version may be delivered. The UI never offered "raw",
  // but the API previously accepted it, so any client could push unfiltered
  // text to the receiver — the exact outcome this product exists to prevent.
  const { versionSent } = body.data;
  if (versionSent !== undefined && versionSent !== "rephrased") {
    return badRequest("raw_delivery_not_permitted");
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, senderId: user.id, status: "draft" },
  });

  if (!message) {
    return Response.json({ error: "message_not_found" }, { status: 404 });
  }

  if (!message.contentRephrased) {
    return badRequest("no_rephrased_version");
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      versionSent: "rephrased",
      senderApproved: true,
      status: "sent",
      sentAt: new Date(),
    },
  });

  return Response.json({
    sent: true,
    messageId: updated.id,
    sentAt: updated.sentAt?.toISOString(),
  });
}
