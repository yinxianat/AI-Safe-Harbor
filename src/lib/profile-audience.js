import { checkTopicBoundaries } from "./topic-checker.js";

/**
 * Audience logic for self-description content (About Me notes, Know Me
 * answers).
 *
 * Messages have exactly one receiver, so one set of boundaries decides
 * whether they send. Profile content is shown to several people at once, so
 * each contact gets judged separately: one contact's red topic withholds the
 * note from that contact only, rather than blocking the post for everyone.
 */

/**
 * Who a note is addressed to, before boundaries are applied.
 * An empty `visibleTo` means every contact, and stays dynamic — contacts
 * added later are included.
 */
export function intendedAudience(contacts, visibleTo) {
  if (!Array.isArray(visibleTo) || visibleTo.length === 0) return contacts;
  const wanted = new Set(visibleTo);
  return contacts.filter((c) => wanted.has(c.connectionId));
}

/**
 * Judge `text` against every contact in the intended audience.
 *
 * @param text          the note as written
 * @param contacts      [{ connectionId, name, topicSettings }]
 * @param visibleTo     connection ids the author picked; [] = everyone
 * @returns {{
 *   perContact: Array<{connectionId, name, status, redTopics, yellowTopics, unenforceable}>,
 *   blocked:   Array<{connectionId, name, redTopics}>,
 *   softened:  Array<{connectionId, name, yellowTopics}>,
 *   excludedFrom: string[],
 *   deliverableTo: string[],
 *   blockedEntirely: boolean
 * }}
 */
export function reviewForAudience(text, contacts, visibleTo) {
  const audience = intendedAudience(contacts || [], visibleTo);

  const perContact = audience.map((contact) => {
    const check = checkTopicBoundaries(text, contact.topicSettings || []);
    const redTopics = check.redTopics || [];
    const yellowTopics = check.yellowTopics || [];
    // A red topic whose boundary has a user note ("in-laws only, not other
    // family") can't be judged by keywords alone. Treat it as "review" — the
    // tune step runs the AI with the note so the actual rule is enforced
    // there. Downgrading from "blocked" means the author still gets the
    // chance to produce a version that respects the note.
    const noteReviewTopics = check.redTopicsWithNote || [];
    const status = redTopics.length > 0
      ? "blocked"
      : (yellowTopics.length > 0 || noteReviewTopics.length > 0)
        ? "gentle"
        : "clear";
    return {
      connectionId: contact.connectionId,
      name: contact.name,
      status,
      redTopics,
      yellowTopics: [...yellowTopics, ...noteReviewTopics],
      // A red/yellow boundary with no keywords can't be checked. Surfaced
      // rather than passed, so the author isn't told "clear" about a topic
      // we were unable to evaluate.
      unenforceable: check.unenforceable || [],
    };
  });

  const blocked = perContact
    .filter((c) => c.status === "blocked")
    .map(({ connectionId, name, redTopics }) => ({ connectionId, name, redTopics }));

  const softened = perContact
    .filter((c) => c.status === "gentle")
    .map(({ connectionId, name, yellowTopics }) => ({ connectionId, name, yellowTopics }));

  const excludedFrom = blocked.map((c) => c.connectionId);
  const deliverableTo = perContact
    .filter((c) => c.status !== "blocked")
    .map((c) => c.connectionId);

  return {
    perContact,
    blocked,
    softened,
    excludedFrom,
    deliverableTo,
    // Only true when there was an audience and every single member is
    // blocked. Posting then would reach nobody, so the UI refuses instead of
    // silently storing something no one can read.
    blockedEntirely: audience.length > 0 && deliverableTo.length === 0,
  };
}

/**
 * Whether one viewer may read a stored note.
 * `visibleTo` is an allow-list when non-empty; `excludedFrom` always wins.
 */
export function canView(entry, connectionId) {
  const excluded = entry.excludedFrom || [];
  if (excluded.includes(connectionId)) return false;
  const allowed = entry.visibleTo || [];
  return allowed.length === 0 || allowed.includes(connectionId);
}

/**
 * The text one viewer should see: their tuned variant when the author
 * approved one, otherwise the note as written.
 */
export function textForViewer(entry, connectionId, field = "text") {
  const variants = entry.variants;
  if (variants && typeof variants === "object" && !Array.isArray(variants)) {
    const variant = variants[connectionId];
    if (typeof variant === "string" && variant.trim()) return variant;
  }
  return entry[field];
}

/**
 * Keep only variants whose connection can actually read the note, and drop
 * blanks. Without this, revoking someone's access would leave their tuned
 * copy behind to be served again if access were later restored.
 */
export function pruneVariants(variants, allowedConnectionIds) {
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) return null;
  const allowed = new Set(allowedConnectionIds);
  const out = {};
  for (const [connectionId, value] of Object.entries(variants)) {
    if (!allowed.has(connectionId)) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    out[connectionId] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}
