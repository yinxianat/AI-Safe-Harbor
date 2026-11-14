import { safetyClause, validateRephrasedOutput } from "./safety.js";
import { languageInstruction, writingNotes } from "./language.js";
import { emotionsForPrompt } from "../emotions.js";
import { resolveChain } from "./index.js";
import { logWarn } from "../logger.js";

/**
 * The emotional shield: reader-side softening of other people's words.
 *
 * This is a different job from the sender-side rephraser, and it needs its
 * own prompt. The rephraser serves the SENDER — it carries their words in
 * the receiver's preferred tone, and the sender approves the result before
 * it is sent. The shield serves the READER — it softens incoming text that
 * the reader never gets to approve, on content (a status, a wall post, a
 * Know Me answer) whose author is not even present.
 *
 * That asymmetry sets the constraints. The reader asked for a gentler
 * version, so softening is wanted; but the author's meaning is not the
 * reader's to change, and a shield that hid a real problem would be worse
 * than no shield. So:
 *
 *   - Every fact, request, decision and boundary survives verbatim in
 *     substance.
 *   - Intensity comes down; the subject does not move.
 *   - Nothing is added. Not reassurance, not a silver lining, not advice.
 *   - If the text carries no load from the reader's chosen emotions, it is
 *     returned unchanged. Doing nothing is the common case and the correct
 *     one.
 *
 * Authors are told who has the shield on (see the `shieldedReaders` field
 * the profile and compose routes return), so nobody is surprised that
 * their words read differently to one particular person.
 */

const MAX_TOKENS = 900;

/** The one safety-critical exception, stated as its own rule. */
const CRISIS_RULE =
  "If the text describes self-harm, suicidal thinking, abuse, violence or immediate danger, return it COMPLETELY UNCHANGED. Softening a call for help is the one failure here that cannot be undone, and it outranks the reader's preference for a gentler tone.";

export function buildShieldPrompt({ emotions, rawText }) {
  const emotionList = emotionsForPrompt(emotions);
  if (!emotionList) return null;

  return `You soften the emotional intensity of a message before a reader sees it. The reader has asked for this; the author has not been consulted and is not present.

You are not summarising, replying, advising or translating. You return the same message with its emotional load carried at a lower intensity.

${safetyClause([
  CRISIS_RULE,
  "Return ONLY the softened text. No preamble, no explanation, no note about what you changed.",
  "If the text does not carry any of the emotions listed below, return it unchanged, character for character. This is the most common correct outcome.",
])}

Soften these emotions when you find them:
${emotionList}

How to soften:
- Keep EVERY fact, number, date, name, request, decision and boundary exactly as written. You are lowering volume, not editing content.
- Keep the author's position. If they are upset about something, they are still upset about it afterwards — the reader must not come away thinking everything is fine when it is not.
- Replace shouting with plain statement: no ALL CAPS, no runs of !!! or ???.
- Replace absolutes aimed at the reader ("you always", "you never") with what was actually described.
- Drop insults, name-calling and sarcasm entirely; keep the grievance underneath them.
- Do NOT add comfort, reassurance, apology, affection, optimism or advice the author did not write. The reader asked for less heat, not for a different message.
- Do NOT make the text longer. A softened version is usually the same length or shorter.
- ${languageInstruction(rawText)}
${writingNotes(rawText)}

Respond with ONLY the softened text.`;
}

/**
 * Soften one piece of text for one reader.
 *
 * Returns `{ text, softened }`. `softened` is false when nothing was
 * changed, which the caller can use to skip the "softened for you" badge.
 *
 * Fails OPEN, deliberately and unlike the sender-side rephraser: if the AI
 * is unavailable or its output fails the output check, the reader sees the
 * ORIGINAL text. The alternative — hiding a contact's status because a
 * provider is down — would make an outage look like the other person had
 * gone quiet, which is worse than a moment of unsoftened text on a surface
 * the reader opted into.
 */
export async function softenForReader({ text, emotions }) {
  if (typeof text !== "string" || !text.trim()) {
    return { text, softened: false };
  }

  const system = buildShieldPrompt({ emotions, rawText: text });
  if (!system) return { text, softened: false };

  const chain = resolveChain();
  if (chain.length === 0) return { text, softened: false, reason: "ai_unavailable" };

  for (const provider of chain) {
    try {
      const result = await provider.complete({
        system,
        userMessage: text,
        model: provider.defaultModel(),
        maxTokens: MAX_TOKENS,
      });

      const checked = validateRephrasedOutput(result.text, text);
      if (!checked.ok) {
        logWarn(
          `ai.shield.${provider.name}`,
          "shield output rejected by the output check, trying next in chain",
          checked.reason
        );
        continue;
      }

      const unchanged = checked.text.trim() === text.trim();
      return {
        text: checked.text,
        softened: !unchanged,
        provider: provider.name,
        model: result.model,
      };
    } catch (err) {
      logWarn(
        `ai.shield.${provider.name}`,
        "shield provider unavailable, trying next in chain",
        err?.cause?.message || err?.message
      );
    }
  }

  // Fail open — see the note on this function.
  return { text, softened: false, reason: "ai_unavailable" };
}

/**
 * Soften many pieces of text for one reader, in parallel.
 *
 * Used by the feed and profile routes, which render a page's worth of items
 * at once. Each item is independent, so one failure degrades that item to
 * its original text rather than the whole page.
 *
 * Capped concurrency: a feed of 40 items would otherwise open 40 provider
 * connections at once and hit a rate limit that fails all of them.
 */
export async function softenMany({ items, emotions, concurrency = 4 }) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const out = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      out[index] = await softenForReader({ text: item, emotions });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return out;
}
