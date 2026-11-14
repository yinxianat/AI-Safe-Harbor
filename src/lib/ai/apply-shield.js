import { softenForReader, softenMany } from "./shield.js";
import { sanitizeEmotions } from "../emotions.js";

/**
 * Convenience over `softenForReader` / `softenMany` for route handlers.
 *
 * A read path does not always know in advance whether the shield should
 * fire: a reader may have turned it off, or narrowed it to emotions that
 * don't overlap with any text on the page. Each wrapper returns a shape
 * that lets the UI say "softened" or "original" per item, and never
 * blocks on an unavailable AI.
 */

/**
 * Return the effective shield for a user, or null when they disabled it.
 * Kept here so a caller never needs to reach into user columns directly.
 */
export function effectiveShield(user) {
  if (!user || user.emotionalShield === false) return null;
  const emotions = sanitizeEmotions(user.emotionalShieldEmotions || []);
  if (emotions.length === 0) return null;
  return { emotions };
}

/**
 * Soften one string for the given reader. Returns the original on any
 * failure or when the shield is off, so callers can drop this in at
 * display time without branching.
 */
export async function shieldText(reader, text) {
  if (typeof text !== "string" || !text.trim()) {
    return { text, softened: false };
  }
  const shield = effectiveShield(reader);
  if (!shield) return { text, softened: false };
  return softenForReader({ text, emotions: shield.emotions });
}

/**
 * Soften a list of strings in parallel for the same reader.
 *
 * Shape matches `softenMany`: `[{ text, softened, ... }]` aligned to the
 * input array's order. When the shield is off, returns unchanged tuples
 * without touching the AI.
 */
export async function shieldTexts(reader, texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const shield = effectiveShield(reader);
  if (!shield) return texts.map((t) => ({ text: t, softened: false }));
  return softenMany({ items: texts, emotions: shield.emotions });
}
