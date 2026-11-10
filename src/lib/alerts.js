import { sendMail } from "./mailer.js";

// Two channels, deliberately separate:
//
//   ERROR — raised automatically when something breaks. Deduplicated, because
//           one outage must produce one email, not one per affected request.
//   EVENT — raised explicitly for things worth knowing (first signup, provider
//           chain exhausted). NOT deduplicated: the caller chose to send it.
//
// Alert delivery never throws. An alert about a failure must not itself become
// a failure, and it must never route back through the logger that called it.
export const CHANNEL = {
  ERROR: "error",
  EVENT: "event",
};

const PREFIX = {
  [CHANNEL.ERROR]: "[LEEWAY ALERT]",
  [CHANNEL.EVENT]: "[LEEWAY EVENT]",
};

const DEDUP_WINDOW_MS = 15 * 60 * 1000;
const recentAlerts = new Map();

// Non-production deployments tag the subject so an admin sharing one inbox can
// tell which environment raised it. The tag is NOT part of the dedup key —
// otherwise the same fault in staging and production would alert twice.
function environmentTag() {
  const env = process.env.NODE_ENV;
  return env === "production" ? "" : ` [${env || "dev"}]`;
}

function alertsEnabled() {
  return process.env.ALERTS_ENABLED !== "false";
}

function shouldSuppress(subject) {
  const now = Date.now();

  // Opportunistic cleanup so the map cannot grow without bound.
  for (const [key, at] of recentAlerts) {
    if (now - at > DEDUP_WINDOW_MS * 10) recentAlerts.delete(key);
  }

  const last = recentAlerts.get(subject);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return true;

  recentAlerts.set(subject, now);
  return false;
}

export async function notifyAdmin({ channel = CHANNEL.EVENT, subject, body }) {
  try {
    if (!alertsEnabled()) return { sent: false, reason: "alerts_disabled" };

    const to = process.env.ADMIN_EMAIL;
    if (!to) return { sent: false, reason: "no_admin_email" };

    if (channel === CHANNEL.ERROR && shouldSuppress(subject)) {
      return { sent: false, reason: "deduplicated" };
    }

    await sendMail({
      to,
      subject: `${PREFIX[channel] || PREFIX[CHANNEL.EVENT]}${environmentTag()} ${subject}`,
      text: body,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
    });

    return { sent: true };
  } catch (err) {
    // console, never the logger — the logger is what called us.
    console.error("[alerts] could not deliver admin alert:", err?.message);
    return { sent: false, reason: "delivery_failed" };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Test seam only.
export function _resetDedup() {
  recentAlerts.clear();
}
