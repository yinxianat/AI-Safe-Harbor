/**
 * Curated, warm-only reactions. There is deliberately no thumbs-down: the
 * low-key signal for "that was a lot" is `processing`, which asks the sender
 * for space without scoring them. One per message, changeable, clearable.
 */
export const REACTIONS = [
  { key: "loved", emoji: "❤️", label: "Loved it" },
  { key: "thank_you", emoji: "🙏", label: "Thank you" },
  { key: "feel_seen", emoji: "🫂", label: "I feel seen" },
  { key: "laughed", emoji: "😂", label: "Made me laugh" },
  { key: "processing", emoji: "💭", label: "Processing" },
];

export const REACTION_KEYS = REACTIONS.map((r) => r.key);

const BY_KEY = new Map(REACTIONS.map((r) => [r.key, r]));

export function getReaction(key) {
  return BY_KEY.get(key) ?? null;
}

export function isValidReaction(key) {
  return BY_KEY.has(key);
}
