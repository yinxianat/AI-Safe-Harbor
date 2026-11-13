import { getTopic, customTopicKeywords } from "./topics.js";

/**
 * Keyword matchers, compiled once per keyword and cached.
 *
 * Matching was a plain `message.includes(keyword)`, which matches inside
 * words. "however" contains "owe" and "multiple" contains "tip", so with
 * Money marked red, "I would love to come, however I have to work late" was
 * blocked as a forbidden-topic message. The sender was told their message hit
 * a boundary; the receiver never saw it.
 *
 * The anchor is a word boundary at the START plus a limited inflectional
 * suffix at the end. Both halves are needed:
 *   - requiring only a leading boundary still matches "mom" inside "moment"
 *   - requiring a boundary at BOTH ends loses "invest" → "investment" and
 *     "bill" → "bills", and under-matching a red topic is the worse failure
 *     because it delivers a message the receiver forbade.
 */
const SUFFIX = "(?:s|es|ed|d|ing|er|ers|ment|ments|ful|ly|al|'s|\u2019s)?\\b";
const matcherCache = new Map();

function keywordMatcher(keyword) {
  let matcher = matcherCache.get(keyword);
  if (matcher) return matcher;

  const escaped = keyword
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // A phrase keyword should still match across a line break or double space.
    .replace(/\s+/g, "\\s+");

  // \b before a keyword that opens with a non-word character would never
  // match, so the anchor is only applied when the first character is a word
  // character. No current keyword starts with punctuation, but a custom topic
  // label can.
  const leading = /^\w/.test(keyword) ? "\\b" : "";

  matcher = new RegExp(leading + escaped + SUFFIX, "i");
  matcherCache.set(keyword, matcher);
  return matcher;
}

/** Whether `message` mentions `keyword` as a word rather than inside one. */
export function matchesKeyword(message, keyword) {
  if (typeof message !== "string" || typeof keyword !== "string" || !keyword) {
    return false;
  }
  return keywordMatcher(keyword).test(message);
}

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

    const matched = keywords.some((keyword) => matchesKeyword(lowerMessage, keyword));
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
