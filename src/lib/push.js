import apn from "@parse/node-apn";
import { logWarn, logError } from "./logger.js";

/**
 * APNs client for push notifications to the iOS app.
 *
 * Configured via env, built once per process:
 *   APNS_KEY       base64-encoded `.p8` file contents (not a path; env is
 *                  the only place secrets live on this project)
 *   APNS_KEY_ID    10-character key id from Apple Developer
 *   APNS_TEAM_ID   10-character team id
 *   APNS_TOPIC     bundle id (e.g. "com.leeway")
 *   APNS_PRODUCTION  "true" for production APNs, otherwise sandbox
 *
 * Without the full set, `provider()` returns null and send calls become
 * no-ops — a missing push config must not break the message-send route.
 * A warning is logged on first unreachable config so an operator can see
 * why pushes are silent.
 */

let cached = null;
let warned = false;

function provider() {
  if (cached !== undefined && cached !== null) return cached;
  const keyB64 = process.env.APNS_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;

  if (!keyB64 || !keyId || !teamId) {
    if (!warned) {
      logWarn("push", "APNs disabled — missing env", "set APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID");
      warned = true;
    }
    cached = null;
    return null;
  }

  try {
    cached = new apn.Provider({
      token: {
        key: Buffer.from(keyB64, "base64").toString("utf-8"),
        keyId,
        teamId,
      },
      production: process.env.APNS_PRODUCTION === "true",
    });
    return cached;
  } catch (err) {
    logError("push", "APNs provider init failed", err?.message || String(err));
    cached = null;
    return null;
  }
}

function topic() {
  return process.env.APNS_TOPIC || "com.leeway";
}

/**
 * Send a new-message push to one user, if they have a device token.
 *
 * The preview is the receiver's NAME for the sender (nickname wins over
 * displayName) and a short snippet — never the raw message body in full.
 * Push payloads can be captured by anyone who compromises Apple's APNs
 * or the device lockscreen, so treating the preview as "lockscreen OK"
 * text is the honest line.
 */
export async function sendNewMessagePush({ to, senderName, preview }) {
  const p = provider();
  if (!p) return { sent: 0, reason: "disabled" };
  if (!to?.apnsDeviceToken) return { sent: 0, reason: "no_token" };

  const note = new apn.Notification({
    alert: {
      title: senderName || "New message",
      // 120 chars is enough for a lockscreen hint without splashing a
      // whole message onto a shared screen.
      body: (preview || "").slice(0, 120),
    },
    badge: 1,
    sound: "default",
    topic: topic(),
    payload: { type: "new_message" },
    pushType: "alert",
  });

  try {
    const result = await p.send(note, to.apnsDeviceToken);
    if (result.failed.length > 0) {
      const reason = result.failed[0].response?.reason || "unknown";
      logWarn("push", "APNs rejected", `${reason}`);
      // If the token is invalid, surface it so the caller can clear the
      // row. Everything else is a transient rejection.
      if (reason === "BadDeviceToken" || reason === "Unregistered") {
        return { sent: 0, reason, clearToken: true };
      }
      return { sent: 0, reason };
    }
    return { sent: result.sent.length, reason: "ok" };
  } catch (err) {
    logError("push", "APNs send threw", err?.message || String(err));
    return { sent: 0, reason: "exception" };
  }
}
