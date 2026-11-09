import { getTopic } from "./topics.js";

const EMPTY_RESULT = {
  allowed: true,
  topics: [],
  yellowTopics: [],
  needsSoftening: false,
};

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
  const yellowTopics = [];
  const unenforceable = [];

  for (const setting of receiverTopicSettings) {
    const key = String(setting.topicName ?? "").toLowerCase().replace(/\s+/g, "_");
    const topic = getTopic(key);

    // A boundary we have no keywords for cannot be checked. Silently passing it
    // would deliver a message the receiver marked as off-limits, so surface it
    // instead. Writes are validated against the registry, so this means the
    // registry drifted — a bug, not user input.
    if (!topic) {
      if (setting.comfortLevel === "red" || setting.comfortLevel === "yellow") {
        unenforceable.push(key);
      }
      continue;
    }

    const matched = topic.keywords.some((keyword) => lowerMessage.includes(keyword));
    if (!matched) continue;

    detectedTopics.push(topic.key);
    if (setting.comfortLevel === "red") {
      redTopics.push(topic.key);
    } else if (setting.comfortLevel === "yellow") {
      yellowTopics.push(topic.key);
    }
  }

  if (redTopics.length > 0) {
    return {
      allowed: false,
      heldReason: "red_topic",
      topics: detectedTopics,
      redTopics,
      yellowTopics: [],
      needsSoftening: false,
      unenforceable,
    };
  }

  return {
    allowed: true,
    topics: detectedTopics,
    yellowTopics,
    needsSoftening: yellowTopics.length > 0,
    unenforceable,
  };
}
