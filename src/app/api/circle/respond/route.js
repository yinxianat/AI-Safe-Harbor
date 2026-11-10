import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { activateConnection } from "@/lib/circle.js";
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
  const action = requireString(body.data.action, { maxLength: 16 });
  if (!connectionId || !["accept", "decline"].includes(action)) {
    return badRequest("missing_fields");
  }

  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (
    !connection ||
    connection.status !== "pending" ||
    (connection.userAId !== user.id && connection.userBId !== user.id)
  ) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  // The requester cannot accept their own request. Legacy pending rows have
  // no requester recorded, so there either side may complete it.
  if (connection.requestedById && connection.requestedById === user.id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (action === "decline") {
    // Deleted rather than marked, so the pair can try again later with no
    // tombstone blocking the unique pair constraint.
    await prisma.connection.delete({ where: { id: connectionId } });
    return Response.json({ declined: connectionId });
  }

  await activateConnection(connectionId);
  return Response.json({ accepted: connectionId, status: "active" });
}
