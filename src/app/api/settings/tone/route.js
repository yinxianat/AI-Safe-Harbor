import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { VALID_TONES, isValidTone } from "@/lib/ai/prompt.js";
import { findAccessibleConnection } from "@/lib/connections.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");

  let tonePreference = user.tonePreference;
  let tonePrompt = "";

  if (connectionId) {
    const connection = await findAccessibleConnection(user.id, connectionId);
    if (!connection) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const pref = await prisma.connectionPreference.findUnique({
      where: { connectionId_userId: { connectionId, userId: user.id } },
    });
    if (pref) {
      tonePreference = pref.tonePreference;
      tonePrompt = pref.tonePrompt || "";
    }
  }

  return Response.json({
    tonePreference,
    tonePrompt,
    validTones: VALID_TONES,
  });
}

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const { tonePreference, connectionId } = body.data;
  if (!isValidTone(tonePreference)) {
    return badRequest("invalid_tone");
  }

  const tonePrompt = typeof body.data.tonePrompt === "string"
    ? body.data.tonePrompt.replace(/[\r\n]+/g, " ").trim().slice(0, 200)
    : null;

  if (connectionId) {
    const connection = await findAccessibleConnection(user.id, connectionId);
    if (!connection) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const pref = await prisma.connectionPreference.upsert({
      where: { connectionId_userId: { connectionId, userId: user.id } },
      update: { tonePreference, ...(tonePrompt !== null ? { tonePrompt: tonePrompt || null } : {}) },
      create: { connectionId, userId: user.id, tonePreference, tonePrompt: tonePrompt || null },
    });

    return Response.json({ tonePreference: pref.tonePreference, tonePrompt: pref.tonePrompt || "", connectionId });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { tonePreference },
    select: { tonePreference: true },
  });

  return Response.json({ tonePreference: updated.tonePreference });
}
