import fs from "node:fs";
import {
  SignedDataVerifier,
  Environment,
} from "@apple/app-store-server-library";
import { logError } from "./logger.js";

/**
 * Verify an Apple App Store Server Notification V2 payload and decode it
 * into plain JS objects we can safely act on.
 *
 * Apple signs every notification with a JWS chain rooted in its own
 * public keys. The App Store Server library handles the full verification —
 * reading the x5c cert chain, walking it up to one of Apple's root
 * certificates, confirming the key id, and finally returning the decoded
 * payload. Writing that ourselves would be straight-up cryptographic risk;
 * Apple's library is the right call here even though it adds a dep.
 *
 * Config comes from env:
 *   APPLE_BUNDLE_ID            your app's bundle id (e.g. "com.leeway")
 *   APPLE_TEAM_ID              Apple Developer team id
 *   APPLE_APP_STORE_ENV        "production" | "sandbox"
 *   APPLE_ROOT_CERTS_PATH      directory holding Apple's root certs as .cer
 *                              files. Download from
 *                              https://www.apple.com/certificateauthority/
 *                              (AppleRootCA-G2.cer, AppleRootCA-G3.cer,
 *                              AppleIncRootCertificate.cer,
 *                              AppleComputerRootCertificate.cer)
 *
 * No env → `verifier()` returns null and `verifyAndDecode()` returns null
 * too, so a deployment missing Apple config fails closed on the webhook
 * rather than quietly accepting any signed payload.
 */

let cached = null;

function loadCerts(dir) {
  try {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".cer"));
    return files.map((f) => fs.readFileSync(`${dir}/${f}`));
  } catch (err) {
    logError("apple.receipt", "cannot read Apple root certs", err?.message || String(err));
    return null;
  }
}

/**
 * Get a configured verifier, or null when env is incomplete.
 *
 * Cached because building the verifier parses every root cert; doing that
 * on every webhook call would be wasteful.
 */
export function verifier() {
  if (cached !== null) return cached;

  const bundleId = process.env.APPLE_BUNDLE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const certDir = process.env.APPLE_ROOT_CERTS_PATH;
  const envName = (process.env.APPLE_APP_STORE_ENV || "production").toLowerCase();

  if (!bundleId || !teamId || !certDir) {
    cached = null;
    return null;
  }

  const certs = loadCerts(certDir);
  if (!certs || certs.length === 0) {
    cached = null;
    return null;
  }

  const environment = envName === "sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;

  // appAppleId is only required for Server-to-Server Notifications in
  // sandbox; leave undefined otherwise. enableOnlineChecks pulls fresh
  // CRLs — turning it on is more secure, off is faster. On for prod.
  cached = new SignedDataVerifier(
    certs,
    environment === Environment.PRODUCTION,
    environment,
    bundleId,
    undefined
  );
  return cached;
}

/**
 * Decode a signedPayload string from a V2 webhook body.
 *
 * Returns the decoded notification object with:
 *   - notificationType, subtype, notificationUUID
 *   - data: { signedTransactionInfo, signedRenewalInfo, environment, ... }
 *
 * Returns null on any verification failure. The webhook route should
 * respond 401 in that case — a bad signature is either a misconfiguration
 * or someone trying to forge subscription state.
 */
export async function verifyAndDecode(signedPayload) {
  if (typeof signedPayload !== "string" || !signedPayload) return null;
  const v = verifier();
  if (!v) {
    logError("apple.receipt", "verifier not configured", "set APPLE_BUNDLE_ID, APPLE_TEAM_ID, APPLE_ROOT_CERTS_PATH");
    return null;
  }

  try {
    const decoded = await v.verifyAndDecodeNotification(signedPayload);
    // Also decode the two nested signed blobs the webhook's `data` carries,
    // so the caller doesn't need to think about the JWS wrapping twice.
    if (decoded?.data?.signedTransactionInfo) {
      decoded.data.transactionInfo = await v.verifyAndDecodeTransaction(
        decoded.data.signedTransactionInfo
      );
    }
    if (decoded?.data?.signedRenewalInfo) {
      decoded.data.renewalInfo = await v.verifyAndDecodeRenewalInfo(
        decoded.data.signedRenewalInfo
      );
    }
    return decoded;
  } catch (err) {
    logError("apple.receipt", "signature verification failed", err?.message || String(err));
    return null;
  }
}

/**
 * Which Leeway plan does an Apple productId map to?
 *
 * Centralised so the webhook, the /api/billing/link route and the paywall
 * UI all agree on the mapping. Product ids live in App Store Connect and
 * are also baked into StoreKit on iOS.
 */
export function planForProductId(productId) {
  if (typeof productId !== "string") return "free";
  if (productId.startsWith("leeway.pro")) return "pro";
  if (productId.startsWith("leeway.plus")) return "plus";
  return "free";
}

/**
 * Translate a V2 notificationType to the user's new plan state.
 *
 * Returns `{ plan, expiresAt }`. "Downgrade events" (EXPIRED, REFUND,
 * REVOKE, GRACE_PERIOD_EXPIRED) force plan back to "free" so a lapsed
 * sub can't linger; the renewal/subscribe/change events use the product
 * id as the source of truth.
 */
export function stateFromNotification(notification) {
  const type = notification?.notificationType;
  const tx = notification?.data?.transactionInfo || {};
  const expiresAt = tx.expiresDate ? new Date(Number(tx.expiresDate)) : null;
  const productPlan = planForProductId(tx.productId);

  const downgrading = new Set([
    "EXPIRED",
    "REFUND",
    "REFUND_DECLINED",
    "REVOKE",
    "GRACE_PERIOD_EXPIRED",
  ]);
  const plan = downgrading.has(type) ? "free" : productPlan;
  return { plan, expiresAt };
}
