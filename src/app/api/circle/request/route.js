import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { findConnectionBetween } from "@/lib/circle.js";
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

  const userId = requireString(body.data.userId, { maxLength: 64 });
  if (!userId) {
    return badRequest("missing_userId");
  }
  if (userId === user.id) {
    return badRequest("cannot_request_self");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || !target.username) {
    // Only users who claimed a handle are findable, so only they can be
    // requested — the same opt-in that governs search.
    return Response.json({ error: "user_not_found" }, { status: 404 });
  }

  const existing = await findConnectionBetween(user.id, userId);
  if (existing) {
    return Response.json(
      {
        error: existing.status === "active" ? "already_connected" : "request_exists",
        connectionId: existing.id,
      },
      { status: 409 }
    );
  }

  const connection = await prisma.connection.create({
    data: {
      userAId: user.id,
      userBId: userId,
      requestedById: user.id,
      status: "pending",
    },
  });

  return Response.json({ connectionId: connection.id, status: "pending" });
}

export async function DELETE(request) {
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

  // Only the requester may cancel, and only while still pending.
  const result = await prisma.connection.deleteMany({
    where: { id: connectionId, requestedById: user.id, status: "pending" },
  });

  if (result.count === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ cancelled: connectionId });
}
