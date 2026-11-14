import prisma from "./db.js";
import { getTopicLabel } from "./topics.js";
import { sanitizeTone } from "./tones.js";

/**
 * The receiver's preferences for one connection, in the shape
 * `rephraseMessage` expects.
 *
 * This exists because compose and retry built that object separately and had
 * drifted apart. Retry passed only `tonePreference` and `yellowTopics`, so a
 * retried message silently ignored the relationship type, the per-topic notes
 * and the extra instructions, and used the receiver's account-wide tone
 * instead of the one they set for this specific connection. Choosing
 * "spouse" on the tuning page therefore had no effect on a retried message,
 * and per-connection isolation — the app's central promise — did not hold on
 * that path.
 *
 * One builder means a preference added here reaches every rephrasing route.
 */

/**
 * Load the per-connection context a rewrite needs.
 *
 * `topicSettings` is returned as well as consumed, because callers run the
 * keyword boundary check against the same rows and loading them twice would
 * be a second round trip for identical data.
 */
export async function loadReceiverContext(connectionId, receiverId) {
  const [receiver, topicSettings, connPref] = await Promise.all([
    prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, tonePreference: true, locale: true, emotionalShield: true, emotionalShieldEmotions: true },
    }),
    prisma.topicSetting.findMany({ where: { connectionId, userId: receiverId } }),
    prisma.connectionPreference.findUnique({
      where: { connectionId_userId: { connectionId, userId: receiverId } },
    }),
  ]);

  return { receiver, topicSettings, connPref };
}

/** The receiver's own clarifications for topics they did not mark green. */
export function topicNotesFrom(topicSettings) {
  return (topicSettings || [])
    .filter((s) => s.note && s.comfortLevel !== "green")
    .map((s) => ({
      topic: s.sanitizedLabel || getTopicLabel(s.topicName) || s.topicName,
      note: s.note,
    }));
}

/**
 * Assemble the settings object for `rephraseMessage`.
 *
 * The per-connection tone wins over the account-wide one: the whole point of
 * per-connection isolation is that the same person can ask to be spoken to
 * differently by different people.
 *
 * @returns {{ tonePreference, tonePrompt, relationshipType, yellowTopics, topicNotes }}
 */
export function buildRephraseSettings({ connection, receiver, connPref, topicSettings, boundaryCheck }) {
  const readerShield = receiver?.emotionalShield === false
    ? null
    : {
        enabled: true,
        emotions: Array.isArray(receiver?.emotionalShieldEmotions)
          ? receiver.emotionalShieldEmotions
          : [],
      };

  return {
    readerShield,
    tonePreference: sanitizeTone(connPref?.tonePreference || receiver?.tonePreference),
    tonePrompt: connPref?.tonePrompt || null,
    relationshipType: connection?.relationshipType || "other",
    yellowTopics: boundaryCheck?.yellowTopics || [],
    topicNotes: topicNotesFrom(topicSettings),
    // Per-connection: the same reader can want softening from one contact
    // and not another. Defaults to false, so no existing connection sees a
    // behaviour change until the reader turns it on.
    softenEmotions: connPref?.softenEmotions === true,
  };
}

/**
 * What actually shaped a rewrite, for display to the sender.
 *
 * Returned to the client so the tuned preview can name the relationship and
 * tone it was written for. Without it the sender picks "spouse" and
 * "warm & gentle" on the tuning page, sees a rewrite, and has no way to tell
 * whether either setting was applied — which is indistinguishable from the
 * settings being ignored, and they were in fact being ignored on retry.
 *
 * Carries no free text: `tonePrompt` and the topic notes are the receiver's
 * private words and must not be echoed back to the sender, so only their
 * presence is reported.
 */
export function appliedSummary(settings) {
  return {
    relationshipType: settings.relationshipType,
    tonePreference: settings.tonePreference,
    hasExtraInstructions: Boolean(settings.tonePrompt),
    gentleTopicCount: (settings.yellowTopics || []).length,
    softeningApplied: Boolean(settings.softenEmotions),
    // What the RECEIVER's account-wide shield will do when they open the
    // message. The author sees this so they are not surprised by text
    // reading softer on the other side.
    readerShield: settings.readerShield || null,
  };
}
