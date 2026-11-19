import prisma from "@/lib/db.js";
import { verifyAndDecode, stateFromNotification } from "@/lib/apple-receipt.js";
import { logError, logInfo } from "@/lib/logger.js";

/**
 * Apple's App Store Server Notifications V2 landing pad.
 *
 * Idempotency: Apple retries any non-2xx response. We store each
 * notificationUUID exactly once in AppleReceiptEvent; a duplicate becomes
 * a no-op `{ ok: true, deduped: true }`. The user-row update is also
 * idempotent at the state level (same plan + same expiry).
 *
 * We can't trust the client's reported subscription state, so this is
 * the authoritative channel: it drives User.plan and
 * subscriptionExpiresAt. The iOS client's /api/billing/link call only
 * exists to associate an Apple originalTransactionId with a Leeway
 * userId, since that mapping can't be derived from Apple's payload
 * alone.
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body?.signedPayload) {
    return Response.json({ error: "missing_signed_payload" }, { status: 400 });
  }

  const payload = await verifyAndDecode(body.signedPayload);
  if (!payload) {
    logError("api.billing.apple", "signature verification failed", "signed payload rejected");
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  // Dedupe on Apple's own UUID. Apple sends the same notification
  // several times on any non-2xx response, so a once-only guard here
  // means a flaky deploy doesn't double-apply a plan change.
  const existing = await prisma.appleReceiptEvent.findUnique({
    where: { notificationUUID: payload.notificationUUID },
  });
  if (existing) return Response.json({ ok: true, deduped: true });

  const tx = payload.data?.transactionInfo;
  if (!tx?.originalTransactionId) {
    logError("api.billing.apple", "missing originalTransactionId in payload", payload.notificationType);
    return Response.json({ error: "malformed_payload" }, { status: 400 });
  }

  const { plan, expiresAt } = stateFromNotification(payload);
  const originalTxId = String(tx.originalTransactionId);

  // The user may not be linked yet — the iOS client might call /link
  // milliseconds later. Store the event anyway so the backfill can find
  // it, and attempt the user update when we do know who it belongs to.
  const user = await prisma.user.findFirst({ where: { appleOriginalTxId: originalTxId } });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan, subscriptionExpiresAt: expiresAt },
    });
  } else {
    logInfo("api.billing.apple", "awaiting app handshake for tx", originalTxId);
  }

  await prisma.appleReceiptEvent.create({
    data: {
      notificationUUID: payload.notificationUUID,
      notificationType: payload.notificationType,
      subtype: payload.subtype || null,
      originalTxId,
      appUserId: user?.id || null,
      rawPayload: payload,
    },
  });

  return Response.json({ ok: true });
}
