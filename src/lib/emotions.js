/**
 * The emotional-shield registry.
 *
 * One record per emotion/mental-load state the shield can soften. The list
 * is deliberately broader than classic "big five" emotions because what
 * this product cares about is not emotion taxonomy, it is the texture of
 * everyday messages between two people — "exhaustion" and "overwhelm" are
 * the kind of thing people write at each other, "disgust" is not.
 *
 * Each record carries:
 *   - key: stable identifier stored in the user's shield list
 *   - labelKey: translation key for the UI
 *   - markers: short list of English-language markers the prompt can hint
 *     to the model. These are intentionally brief; the model is better at
 *     spotting the texture than at matching a wordlist, and a long list
 *     turns the clause into noise.
 *
 * Adding an emotion: add it here, add its labelKey in both locales, and
 * run the shield migration again or ALTER TABLE to grow the default.
 */

export const EMOTIONS = [
  {
    key: "anger",
    labelKey: "emotion_anger",
    markers: "anger, blame, 'you always', raised voice",
  },
  {
    key: "frustration",
    labelKey: "emotion_frustration",
    markers: "frustration, exasperation, 'I give up', 'what's the point'",
  },
  {
    key: "anxiety",
    labelKey: "emotion_anxiety",
    markers: "anxiety, worry, catastrophising, 'what if'",
  },
  {
    key: "stress",
    labelKey: "emotion_stress",
    markers: "stress, pressure, deadline-language, 'drowning'",
  },
  {
    key: "overwhelm",
    labelKey: "emotion_overwhelm",
    markers: "overwhelm, 'too much', 'can't cope', 'everything is'",
  },
  {
    key: "burnout",
    labelKey: "emotion_burnout",
    markers: "burnout, running on empty, numbness, apathy",
  },
  {
    key: "sadness",
    labelKey: "emotion_sadness",
    markers: "sadness, grief, tears, 'I miss'",
  },
  {
    key: "despair",
    labelKey: "emotion_despair",
    markers: "hopelessness, 'nothing will change', 'why bother'",
  },
  {
    key: "fear",
    labelKey: "emotion_fear",
    markers: "fear, dread, 'I'm scared', 'what if the worst'",
  },
  {
    key: "shame",
    labelKey: "emotion_shame",
    markers: "shame, self-criticism, 'I'm so stupid', 'I'm broken'",
  },
  {
    key: "guilt",
    labelKey: "emotion_guilt",
    markers: "guilt, apology spirals, 'I ruined it'",
  },
  {
    key: "resentment",
    labelKey: "emotion_resentment",
    markers: "resentment, score-keeping, 'again', 'as usual'",
  },
  {
    key: "loneliness",
    labelKey: "emotion_loneliness",
    markers: "loneliness, isolation, 'no one', 'alone'",
  },
  {
    key: "exhaustion",
    labelKey: "emotion_exhaustion",
    markers: "exhaustion, 'can't anymore', fatigue, 'drained'",
  },
  {
    key: "harshness",
    labelKey: "emotion_harshness",
    markers: "harsh tone, insults, sarcasm, all-caps, excessive punctuation",
  },
];

export const EMOTION_KEYS = EMOTIONS.map((e) => e.key);

const BY_KEY = Object.fromEntries(EMOTIONS.map((e) => [e.key, e]));

/** All emotions turned on. The default a new user starts with. */
export const DEFAULT_SHIELD_EMOTIONS = EMOTION_KEYS.slice();

export function isValidEmotion(key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(BY_KEY, key);
}

/**
 * Normalise a stored emotion list.
 *
 * Accepts anything from an empty array to a mix of known and unknown keys,
 * drops the unknowns, and de-duplicates. Returning a value through this
 * function before using it means an old column with a removed key, or a
 * client sending junk, never trips a lookup downstream.
 */
export function sanitizeEmotions(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (!isValidEmotion(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

export function getEmotion(key) {
  return isValidEmotion(key) ? BY_KEY[key] : null;
}

/**
 * A concise description of the emotions the shield should soften, suitable
 * for inclusion in a prompt. Returns null when the list is empty — the
 * caller should omit the whole clause in that case, not emit "soften
 * nothing".
 */
export function emotionsForPrompt(enabledKeys) {
  const picked = sanitizeEmotions(enabledKeys).map((k) => BY_KEY[k]);
  if (picked.length === 0) return null;
  return picked.map((e) => `- ${e.key}: ${e.markers}`).join("\n");
}
