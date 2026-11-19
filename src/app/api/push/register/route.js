import prisma from "@/lib/db.js";
import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";

/**
 * Register the APNs device token for the signed-in user.
 *
 * The iOS client calls this every time the token changes — reinstalls
 * invalidate the previous token, and Apple may rotate it. Last-write-wins
 * is fine because this product doesn't support multi-device push: one
 * token per account.
 *
 * Sent as `{ token: "<hex>" }`. 64-byte APNs tokens render to 128 hex
 * characters; we accept up to 256 so anything Apple ships fits.
 */
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const token = requireString(body.data.token, { maxLength: 256 });
  if (!token) return badRequest("missing_token");
  if (!/^[0-9a-fA-F]+$/.test(token)) return badRequest("not_hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      apnsDeviceToken: token.toLowerCase(),
      apnsDeviceTokenUpdatedAt: new Date(),
    },
  });
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  await prisma.user.update({
    where: { id: user.id },
    data: { apnsDeviceToken: null, apnsDeviceTokenUpdatedAt: new Date() },
  });
  return Response.json({ ok: true });
}
