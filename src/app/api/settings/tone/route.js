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
  // Per-connection only; the account-wide default stays off until the reader
  // chooses it for a specific contact.
  let softenEmotions = false;

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
      softenEmotions = pref.softenEmotions;
    }
  }

  return Response.json({
    tonePreference,
    tonePrompt,
    softenEmotions,
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

  // Only forwarded when the caller sent it. Omitting the field keeps the
  // stored value — a tone edit should not quietly flip someone's softening
  // choice back to the default.
  const softenEmotions = typeof body.data.softenEmotions === "boolean"
    ? body.data.softenEmotions
    : null;

  if (connectionId) {
    const connection = await findAccessibleConnection(user.id, connectionId);
    if (!connection) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const pref = await prisma.connectionPreference.upsert({
      where: { connectionId_userId: { connectionId, userId: user.id } },
      update: {
        tonePreference,
        ...(tonePrompt !== null ? { tonePrompt: tonePrompt || null } : {}),
        ...(softenEmotions !== null ? { softenEmotions } : {}),
      },
      create: {
        connectionId,
        userId: user.id,
        tonePreference,
        tonePrompt: tonePrompt || null,
        softenEmotions: softenEmotions ?? false,
      },
    });

    return Response.json({
      tonePreference: pref.tonePreference,
      tonePrompt: pref.tonePrompt || "",
      softenEmotions: pref.softenEmotions,
      connectionId,
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { tonePreference },
    select: { tonePreference: true },
  });

  return Response.json({ tonePreference: updated.tonePreference });
}
