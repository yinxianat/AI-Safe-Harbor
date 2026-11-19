import prisma from "@/lib/db.js";
import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { stateFromNotification, planForProductId } from "@/lib/apple-receipt.js";

/**
 * Link an Apple originalTransactionId to the signed-in Leeway user.
 *
 * The iOS client calls this right after StoreKit confirms a purchase,
 * posting { originalTxId, productId, expiresAt? }. We write the mapping
 * on the user row and, if we already stored the matching Apple webhook
 * event from before the client got here, backfill the plan + expiry from
 * that event. If the webhook hasn't arrived yet, we set the plan from
 * the client's reported productId — Apple's later webhook will overwrite
 * it idempotently with the authoritative state.
 */
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const originalTxId = requireString(body.data.originalTxId, { maxLength: 64 });
  const productId = requireString(body.data.productId, { maxLength: 128 });
  if (!originalTxId || !productId) return badRequest("missing_fields");

  // Refuse re-linking to a different user's tx id. The iOS client has
  // no way to send another user's tx, but an attacker who stole an
  // access token could try.
  const existingOwner = await prisma.user.findFirst({ where: { appleOriginalTxId: originalTxId } });
  if (existingOwner && existingOwner.id !== user.id) {
    return Response.json({ error: "tx_belongs_to_another_user" }, { status: 409 });
  }

  // If the webhook already arrived, replay its state onto this user.
  const priorEvent = await prisma.appleReceiptEvent.findFirst({
    where: { originalTxId },
    orderBy: { processedAt: "desc" },
  });

  let plan = planForProductId(productId);
  let expiresAt = null;
  if (priorEvent?.rawPayload) {
    const derived = stateFromNotification(priorEvent.rawPayload);
    plan = derived.plan;
    expiresAt = derived.expiresAt;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      appleOriginalTxId: originalTxId,
      plan,
      subscriptionExpiresAt: expiresAt,
    },
  });

  // Backfill the event's appUserId so any future audit sees the link.
  if (priorEvent && !priorEvent.appUserId) {
    await prisma.appleReceiptEvent.update({
      where: { id: priorEvent.id },
      data: { appUserId: user.id },
    });
  }

  return Response.json({ ok: true, plan, subscriptionExpiresAt: expiresAt });
}
