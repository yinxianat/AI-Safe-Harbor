import { getTopic, customTopicKeywords } from "./topics.js";

const EMPTY_RESULT = {
  allowed: true,
  topics: [],
  yellowTopics: [],
  needsSoftening: false,
  needsAIReview: false,
};

/**
 * Keyword-based first pass over receiver's topic boundaries.
 *
 * Returns three outcomes:
 *   - allowed: nothing red matched, maybe some yellow
 *   - allowed=false, needsAIReview=false: red match with no note → hard block
 *   - allowed=false, needsAIReview=true: red match WITH a note → defer to AI
 *
 * The third outcome matters because a note like "in-laws only, not other
 * family" shrinks the real boundary. Keyword matching alone cannot tell
 * whether a message about the sender's own son violates a rule that only
 * forbids in-law topics — so we hand the decision to the AI, which gets the
 * note as context. Without this branch, any mention of "mother" or "son"
 * blocks the message regardless of what the receiver actually described.
 */
export function checkTopicBoundaries(messageText, receiverTopicSettings) {
  if (typeof messageText !== "string" || !messageText.trim()) {
    return { ...EMPTY_RESULT };
  }

  if (!Array.isArray(receiverTopicSettings) || receiverTopicSettings.length === 0) {
    return { ...EMPTY_RESULT };
  }

  const lowerMessage = messageText.toLowerCase();
  const detectedTopics = [];
  const redTopics = [];
  // Red topics whose matched boundary carries a user note — these are not
  // hard-blocked; the AI has to interpret them against the note.
  const redTopicsWithNote = [];
  const yellowTopics = [];
  const unenforceable = [];

  for (const setting of receiverTopicSettings) {
    const key = String(setting.topicName ?? "").toLowerCase().replace(/\s+/g, "_");
    const topic = getTopic(key);

    // A custom topic carries its own keywords: the words of its label.
    const keywords = topic
      ? topic.keywords
      : setting.isCustom
        ? customTopicKeywords(setting.sanitizedLabel)
        : [];

    // A boundary we have no keywords for cannot be checked. Silently passing it
    // would deliver a message the receiver marked as off-limits, so surface it
    // instead. Writes are validated against the registry, so this means the
    // registry drifted — a bug, not user input.
    if (keywords.length === 0) {
      if (setting.comfortLevel === "red" || setting.comfortLevel === "yellow") {
        unenforceable.push(key);
      }
      continue;
    }

    const matched = keywords.some((keyword) => lowerMessage.includes(keyword));
    if (!matched) continue;

    const topicKey = topic?.key ?? key;
    detectedTopics.push(topicKey);
    if (setting.comfortLevel === "red") {
      if (setting.note && String(setting.note).trim()) {
        redTopicsWithNote.push(topicKey);
      } else {
        redTopics.push(topicKey);
      }
    } else if (setting.comfortLevel === "yellow") {
      yellowTopics.push(topicKey);
    }
  }

  // Hard red without a note: block before any AI call.
  if (redTopics.length > 0) {
    return {
      allowed: false,
      heldReason: "red_topic",
      topics: detectedTopics,
      redTopics,
      yellowTopics: [],
      needsSoftening: false,
      needsAIReview: false,
      unenforceable,
    };
  }

  // Red with a note: don't block yet. The caller runs AI analysis with the
  // note; if the AI confirms the violation the message is held there.
  if (redTopicsWithNote.length > 0) {
    return {
      allowed: true,
      needsAIReview: true,
      redTopicsWithNote,
      topics: detectedTopics,
      yellowTopics,
      needsSoftening: yellowTopics.length > 0,
      unenforceable,
    };
  }

  return {
    allowed: true,
    topics: detectedTopics,
    yellowTopics,
    needsSoftening: yellowTopics.length > 0,
    needsAIReview: false,
    unenforceable,
  };
}
