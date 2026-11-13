/**
 * The tone registry: one definition per tone, used by the prompt builder, the
 * settings API and every screen that renders a tone.
 *
 * It was previously eight parallel lists — the valid-value array, the model's
 * descriptions, two label maps in page components, a third in the partner API
 * and the translation keys — so adding a tone meant editing six files and
 * adding it to five of them produced a tone that saved but rendered as
 * "Warm & gentle" everywhere.
 *
 * `guardrail` is the part that matters for safety. A tone instruction is a
 * licence the model takes broadly: "playful" alone has produced teasing at the
 * receiver's expense, and "direct" alone has produced blunt criticism the
 * sender never wrote. Each tone therefore carries the limit that keeps it from
 * turning into something the sender would not have said, and the prompt
 * builder emits it next to the tone itself.
 */

export const TONES = [
  {
    key: "warm_and_gentle",
    labelKey: "tone_warm_and_gentle",
    shortLabelKey: "tone_warm_and_gentle_short",
    description: "warm, gentle, and caring",
    guardrail: "Stay honest — do not soften the message so much that its point disappears.",
  },
  {
    key: "direct_and_clear",
    labelKey: "tone_direct_and_clear",
    shortLabelKey: "tone_direct_and_clear",
    description: "direct, clear, and concise",
    guardrail: "Direct means unambiguous, never harsh. Do not add criticism or a verdict the sender did not write.",
  },
  {
    key: "playful_and_light",
    labelKey: "tone_playful_and_light",
    shortLabelKey: "tone_playful_and_light",
    description: "playful, light, and casual",
    guardrail: "Keep it light without making the sender sound dismissive of something they treated as serious.",
  },
  {
    key: "humorous_and_funny",
    labelKey: "tone_humorous_and_funny",
    shortLabelKey: "tone_humorous_short",
    description: "funny and good-humoured, with a light joke where it fits naturally",
    // Written as hard limits rather than preferences: in testing, "be funny"
    // reliably produced sarcasm, and sarcasm has no tone of voice in text, so
    // the receiver reads it as contempt. Humour here is never at a person's
    // expense and never lands on the part of the message that hurts.
    guardrail:
      "The humour is warm and never at anyone's expense. No sarcasm, no irony, no mockery, no teasing about the receiver's body, habits, family, work or past mistakes. If the message carries real distress, bad news, an apology, a boundary or a conflict, drop the humour entirely and rephrase it plainly — a joke there reads as contempt. Never invent a joke that depends on facts the sender did not give you.",
  },
  {
    key: "calm_and_neutral",
    labelKey: "tone_calm_and_neutral",
    shortLabelKey: "tone_calm_and_neutral",
    description: "calm, neutral, and balanced",
    guardrail: "Neutral in delivery, not in substance — keep the sender's position intact.",
  },
  {
    key: "encouraging_and_supportive",
    labelKey: "tone_encouraging_and_supportive",
    shortLabelKey: "tone_encouraging_short",
    description: "encouraging, supportive, and uplifting",
    guardrail: "Encourage without promising outcomes, minimising a real problem, or adding praise the sender did not give.",
  },
  {
    key: "brief_and_to_the_point",
    labelKey: "tone_brief_and_to_the_point",
    shortLabelKey: "tone_brief_short",
    description: "brief, efficient, and to the point",
    guardrail: "Shorten the wording, never the content. Every point the sender made must survive.",
  },
  {
    key: "thoughtful_and_reflective",
    labelKey: "tone_thoughtful_and_reflective",
    shortLabelKey: "tone_thoughtful_short",
    description: "thoughtful, reflective, and considered",
    guardrail: "Reflect on what the sender wrote. Do not add insight, interpretation or self-analysis of your own.",
  },
  {
    key: "reassuring_and_patient",
    labelKey: "tone_reassuring_and_patient",
    shortLabelKey: "tone_reassuring_short",
    description: "reassuring, patient, and steady",
    guardrail: "Reassure about the sender's intent only. Never promise anything on the sender's behalf.",
  },
  {
    key: "candid_but_kind",
    labelKey: "tone_candid_but_kind",
    shortLabelKey: "tone_candid_short",
    description: "candid and plain-spoken, while still kind",
    // For people who read a softened message as evasive. The limit is the
    // whole point: candour is permission to be clear, not to be blunt.
    guardrail:
      "Say the hard part plainly instead of hinting at it, but never add a judgement, diagnosis or accusation of your own. Candid describes the clarity, not an increase in severity.",
  },
  {
    key: "curious_and_open",
    labelKey: "tone_curious_and_open",
    shortLabelKey: "tone_curious_short",
    description: "curious and open, inviting a reply rather than closing the subject",
    // The most de-escalating option in the set: it turns a statement about the
    // receiver into a question about the situation.
    guardrail:
      "Turn the sender's own point into an open question where that fits naturally. Do not invent questions about matters the sender never raised, and do not turn a stated boundary or decision into a question — that would reverse the sender's meaning.",
  },
  {
    key: "practical_and_solution_focused",
    labelKey: "tone_practical_and_solution_focused",
    shortLabelKey: "tone_practical_short",
    description: "practical and focused on what happens next",
    guardrail:
      "Keep the sender's own next step. Do not propose a plan, a time, a split of work or a solution they did not write.",
  },
  {
    key: "formal_and_respectful",
    labelKey: "tone_formal_and_respectful",
    shortLabelKey: "tone_formal_short",
    description: "polite, formal, and respectful",
    guardrail: "Formal in register only. Do not add deference, apology or hedging the sender did not express.",
  },
];

export const TONE_KEYS = TONES.map((t) => t.key);

const BY_KEY = Object.fromEntries(TONES.map((t) => [t.key, t]));

export const DEFAULT_TONE = "warm_and_gentle";

/**
 * The type check is not redundant. `hasOwnProperty` coerces its key, so an
 * object whose `toString` returns a tone name used to pass — and this function
 * guards the write path, so the value it approved was the object, not the
 * string it impersonated.
 */
export function isValidTone(tone) {
  return typeof tone === "string" && Object.prototype.hasOwnProperty.call(BY_KEY, tone);
}

/**
 * A tone that is safe to act on.
 *
 * Anything unrecognised becomes the default rather than being passed through:
 * a tone string reaches this from a database column and from request bodies,
 * and an unknown value used to be interpolated straight into the prompt, which
 * made the field an injection vector.
 */
export function sanitizeTone(tone) {
  return isValidTone(tone) ? tone : DEFAULT_TONE;
}

export function getTone(tone) {
  return BY_KEY[sanitizeTone(tone)];
}

/** How the model is told to write; never raw user input. */
export function toneDescription(tone) {
  return getTone(tone).description;
}

/** The limit that keeps this tone from exceeding what the sender wrote. */
export function toneGuardrail(tone) {
  return getTone(tone).guardrail;
}

/** Translation key for the full label. */
export function toneLabelKey(tone) {
  return getTone(tone).labelKey;
}

/** Translation key for the compact label used in list rows. */
export function toneShortLabelKey(tone) {
  return getTone(tone).shortLabelKey;
}
