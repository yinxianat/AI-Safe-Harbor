/**
 * Crisis-language detection and support-resource surface.
 *
 * Two user-facing jobs:
 *   1. When the sender writes something that reads as a cry for help
 *      (self-harm, suicidal ideation, abuse, immediate danger), show
 *      support resources BEFORE they send — a boundary block that
 *      hides the resources would be the worst case for this app.
 *   2. When a Health boundary holds a message, check the message for
 *      the same markers. If any fire, the "held" screen names resources
 *      so the sender knows where to go next, rather than being told
 *      "your person isn't ready" and left there.
 *
 * Keyword matching is deliberately simple and English + Chinese. The point
 * is not a clinical screen — those markers would be dangerous to make
 * decisions on — it is "a human who wrote any of these should be given a
 * next step." A false positive here is a free hotline card the user can
 * dismiss, which is a vastly better failure mode than a false negative.
 *
 * No AI call. If the AI layer is down, a cry for help still gets resources.
 */

/**
 * Markers that mean "someone needs a person, not an app." Word-boundary
 * anchored on Latin text; substring-matched on scripts that don't use
 * boundaries, to match topic-checker.js's own matcher rules.
 *
 * Phrases over single words, because "hurt" and "die" fire on ordinary
 * sentences all day. "I want to die" and "want to hurt myself" don't.
 */
const EN_MARKERS = [
  // Self-harm and suicidal ideation
  "want to die", "want to kill myself", "kill myself", "end my life",
  "end it all", "not want to be here", "don't want to be here",
  "dont want to be here", "do not want to be here",
  "hurt myself", "hurting myself", "harm myself", "cut myself",
  "no reason to live", "nothing to live for", "better off dead",
  "better off without me", "suicidal", "suicide",
  // Abuse / violence
  "he hits me", "she hits me", "they hit me", "hit me again",
  "hits me", "hitting me", "hurts me", "scared of him", "scared of her",
  "afraid he'll", "afraid she'll", "afraid of him", "afraid of her",
  "won't let me leave", "wont let me leave",
  "won't let me go", "wont let me go", "trapped at home",
  // Immediate danger
  "i'm not safe", "i am not safe", "i don't feel safe", "i do not feel safe",
  "in danger", "being hurt",
];

// Simplified + Traditional Chinese markers. Short list on purpose —
// scanning for exact phrases keeps false positives low on a screen that
// otherwise discusses normal life.
const ZH_MARKERS = [
  "想死", "不想活", "不想活着", "不想活著",
  "自杀", "自殺", "想自杀", "想自殺",
  "伤害自己", "傷害自己", "割自己",
  "想消失", "想結束", "想结束一切",
  "他打我", "她打我", "打我", "家暴",
  "不让我走", "不讓我走", "走不了",
  "不安全", "没有安全感", "沒有安全感",
  "活不下去",
];

function latinMatch(lower, phrase) {
  // A quick-reject before building a RegExp.
  if (!lower.includes(phrase)) return false;
  // Phrases already include punctuation we expect, but we still want
  // word boundaries at either end so "end my life" matches "I want to end
  // my life." and not "the lifetime".
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, "i").test(lower);
}

/**
 * Whether a message carries any of the crisis markers.
 *
 * Fast, local, no AI. Called by routes and by the compose UI in the same
 * breath; keep it O(n) over the input text.
 */
export function detectsCrisis(text) {
  if (typeof text !== "string") return false;
  const lower = text.toLowerCase();
  for (const phrase of EN_MARKERS) {
    if (latinMatch(lower, phrase)) return true;
  }
  for (const phrase of ZH_MARKERS) {
    if (text.includes(phrase)) return true;
  }
  return false;
}

/**
 * Resources returned to the client.
 *
 * Deliberately not geo-localised: we don't track location, and guessing
 * from locale would show wrong resources for someone travelling. One
 * line in the UI directs them to whichever directory applies.
 */
export const CRISIS_RESOURCES = [
  {
    id: "findahelpline",
    labelKey: "crisis_findahelpline_label",
    descriptionKey: "crisis_findahelpline_desc",
    url: "https://findahelpline.com",
  },
  {
    id: "international",
    labelKey: "crisis_international_label",
    descriptionKey: "crisis_international_desc",
    url: "https://www.iasp.info/suicidalthoughts/",
  },
];
