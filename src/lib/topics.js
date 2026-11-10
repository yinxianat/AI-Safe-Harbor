/**
 * Single source of truth for topics.
 *
 * The key list, keyword map and display labels previously lived in three
 * separate files. A topic present in one but missing from the keyword map was
 * accepted as a Red boundary and then silently never matched — a fail-open
 * violation of the app's core guarantee. One record per topic makes that drift
 * impossible, and `tests/topics.test.js` enforces coverage.
 */

export const TOPICS = [
  {
    key: "health",
    label: "Health",
    keywords: [
      "health", "doctor", "hospital", "sick", "illness", "medicine",
      "therapy", "therapist", "mental health", "anxiety", "depression",
      "diagnosis", "symptoms", "treatment", "medical",
    ],
  },
  {
    key: "work",
    label: "Work",
    keywords: [
      "work", "job", "boss", "office", "career", "colleague", "coworker",
      "meeting", "promotion", "fired", "quit", "salary", "workplace",
      "manager", "project", "deadline",
    ],
  },
  {
    key: "money",
    label: "Money",
    keywords: [
      "money", "budget", "debt", "credit card", "loan", "mortgage",
      "savings", "expenses", "bills", "financial", "rent", "salary",
      "bank", "invest", "spending", "afford", "cost", "price",
      "raise", "owe", "save more",
    ],
  },
  {
    key: "family",
    label: "Family",
    keywords: [
      "family", "mother", "father", "mom", "dad", "parent", "sibling",
      "brother", "sister", "in-law", "mother-in-law", "father-in-law",
      "grandparent", "aunt", "uncle", "cousin", "relative",
      "holidays", "thanksgiving", "christmas",
    ],
  },
  {
    key: "intimacy",
    label: "Intimacy",
    keywords: [
      "intimacy", "intimate", "affection", "romance", "romantic",
      "physical", "desire", "attraction", "bedroom", "closeness",
    ],
  },
  {
    key: "future_plans",
    label: "Future Plans",
    keywords: [
      "future", "plan", "plans", "moving", "relocate", "children",
      "kids", "baby", "marriage", "wedding", "retire", "retirement",
      "house", "apartment", "goal", "goals",
    ],
  },
  {
    key: "past_conflicts",
    label: "Past Conflicts",
    keywords: [
      "fight", "argument", "argued", "fighting", "conflict", "disagreement",
      "last time", "remember when", "you always", "you never",
      "that time", "tense", "tension", "resentment",
    ],
  },
  {
    key: "social_life",
    label: "Social Life",
    keywords: [
      "friends", "social", "party", "going out", "hanging out",
      "weekend plans", "vacation", "trip", "travel",
    ],
  },
  {
    key: "parenting",
    label: "Parenting",
    keywords: [
      "parenting", "discipline", "school", "homework", "daycare",
      "babysitter", "bedtime", "screen time", "allowance",
    ],
  },
  {
    key: "personal_growth",
    label: "Personal Growth",
    keywords: [
      "self-improvement", "growth", "hobby", "hobbies", "exercise",
      "gym", "diet", "weight", "learning", "class", "course",
    ],
  },
];

export const TOPIC_KEYS = TOPICS.map((t) => t.key);

const BY_KEY = new Map(TOPICS.map((t) => [t.key, t]));

export function getTopic(key) {
  return BY_KEY.get(key) ?? null;
}

export function isValidTopicKey(key) {
  return BY_KEY.has(key);
}

export function getTopicLabel(key) {
  return BY_KEY.get(key)?.label ?? key;
}

/**
 * Custom topics: user-entered boundaries beyond the preset ten. The label is
 * the user's words; the key is derived from it; the checker matches on the
 * label's own words, so a custom boundary is enforceable — storing one the
 * checker would silently skip is the fail-open bug this registry exists to
 * prevent.
 */
export const MAX_CUSTOM_TOPICS = 10;
export const CUSTOM_KEY_PREFIX = "custom_";

export function isCustomTopicKey(key) {
  return typeof key === "string" && key.startsWith(CUSTOM_KEY_PREFIX);
}

/**
 * @returns {{ok: true, label: string, key: string} | {ok: false, error: string}}
 *   `error` is user-facing and names the fix.
 */
export function sanitizeCustomTopic(rawLabel) {
  const cleaned = String(rawLabel ?? "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .trim();

  if (cleaned.length < 2) {
    return { ok: false, error: "Give the topic a short name — letters and numbers, at least 2 characters." };
  }

  const key = CUSTOM_KEY_PREFIX + cleaned.toLowerCase().replace(/[\s-]+/g, "_");
  if (isValidTopicKey(cleaned.toLowerCase().replace(/[\s-]+/g, "_"))) {
    return { ok: false, error: "That topic already exists as a preset — set its level directly." };
  }
  return { ok: true, label: cleaned, key };
}

// The label's own words are the keyword list. Short words ("of", "my") would
// match everything, so only words of 3+ characters count, plus the full
// phrase for multi-word labels.
export function customTopicKeywords(sanitizedLabel) {
  const label = String(sanitizedLabel ?? "").toLowerCase().trim();
  if (!label) return [];
  const words = label.split(/\s+/).filter((w) => w.length >= 3);
  return label.includes(" ") ? [label, ...words] : words.length ? words : [label];
}
