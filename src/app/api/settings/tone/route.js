import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { VALID_TONES, isValidTone } from "@/lib/ai/prompt.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    tonePreference: user.tonePreference,
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

  const { tonePreference } = body.data;
  if (!isValidTone(tonePreference)) {
    return badRequest("invalid_tone");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { tonePreference },
    select: { tonePreference: true },
  });

  return Response.json({ tonePreference: updated.tonePreference });
}
