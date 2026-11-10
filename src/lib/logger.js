import { createHash } from "crypto";
import prisma from "./db.js";
import { redact } from "./redact.js";
import { notifyAdmin, CHANNEL } from "./alerts.js";

/**
 * Error logging. Two design rules, both learned the hard way:
 *
 *   1. Logging never throws. A logger that can fail a request turns a minor
 *      problem into an outage, exactly when things are already worst.
 *   2. Logging never recurses. If the database is what broke, we must not try
 *      to log that failure to the database.
 */

export const LEVEL = { WARN: "warn", ERROR: "error", CRITICAL: "critical" };

// Circuit breaker: after this many consecutive database failures we stop
// trying for a cooldown, so a dead database doesn't add a failed write to
// every request on top of whatever already went wrong.
const MAX_CONSECUTIVE_FAILURES = 5;
const COOLDOWN_MS = 60_000;

let consecutiveFailures = 0;
let disabledUntil = 0;

// Re-alert on a problem that is still happening at most this often.
const ALERT_REPEAT_MS = 6 * 60 * 60 * 1000; // 6 hours

function fingerprintOf(source, message) {
  return createHash("sha1").update(`${source}::${message.slice(0, 200)}`).digest("hex");
}

function toStderr(level, source, message, detail) {
  // Deliberately console, not the logger — this is the path used when the
  // logger itself cannot work.
  console.error(`[${level}] ${source}: ${message}${detail ? ` | ${detail}` : ""}`);
}

/**
 * Record an application problem.
 *
 * `message` must be a constant template with NO interpolated values. Varying
 * data goes in `detail`. Interpolating into `message` gives every occurrence a
 * different fingerprint, which defeats deduplication and buries the signal.
 */
export async function logEvent({ level = LEVEL.ERROR, source, message, detail = null }) {
  const safeDetail = redact(detail);
  toStderr(level, source, message, safeDetail);

  if (process.env.LOG_PERSISTENCE === "false") return;
  if (Date.now() < disabledUntil) return;

  try {
    const fingerprint = fingerprintOf(source, message);
    const now = new Date();

    const entry = await prisma.logEntry.upsert({
      where: { fingerprint },
      create: { level, source, message, detail: safeDetail, fingerprint },
      update: {
        count: { increment: 1 },
        lastSeenAt: now,
        detail: safeDetail,
        level,
        resolvedAt: null,
      },
    });

    consecutiveFailures = 0;

    const due =
      !entry.alertedAt || now.getTime() - entry.alertedAt.getTime() > ALERT_REPEAT_MS;

    if (due && level !== LEVEL.WARN) {
      // Record the attempt before sending so a slow mail server cannot produce
      // a burst of duplicate alerts.
      await prisma.logEntry.update({
        where: { id: entry.id },
        data: { alertedAt: now },
      });

      await notifyAdmin({
        channel: CHANNEL.ERROR,
        subject: `${source}: ${message}`,
        body:
          `Level: ${level}\n` +
          `Source: ${source}\n` +
          `Message: ${message}\n` +
          `Occurrences: ${entry.count}\n` +
          `First seen: ${entry.firstSeenAt.toISOString()}\n` +
          `Last seen: ${now.toISOString()}\n` +
          (safeDetail ? `\nDetail:\n${safeDetail}\n` : ""),
      });
    }
  } catch (err) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      disabledUntil = Date.now() + COOLDOWN_MS;
      consecutiveFailures = 0;
      toStderr("critical", "lib.logger", "log persistence disabled after repeated failures", null);
    }
    toStderr("warn", "lib.logger", "could not persist log entry", err?.message);
  }
}

export const logError = (source, message, detail) =>
  logEvent({ level: LEVEL.ERROR, source, message, detail });

export const logWarn = (source, message, detail) =>
  logEvent({ level: LEVEL.WARN, source, message, detail });

export const logCritical = (source, message, detail) =>
  logEvent({ level: LEVEL.CRITICAL, source, message, detail });

// Test seam only.
export function _resetBreaker() {
  consecutiveFailures = 0;
  disabledUntil = 0;
}
