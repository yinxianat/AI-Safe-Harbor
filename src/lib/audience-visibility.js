/**
 * Allow-list arithmetic for the "how others see you" screen.
 *
 * The stored convention is that an empty `visibleTo` means every contact,
 * including ones added later. That makes a single show/hide toggle less
 * obvious than it looks: hiding one item from one person has to be written
 * out as everyone else by name, which quietly converts a dynamic audience
 * into a fixed one — and the reverse has to be handled too, or an audience
 * that is widened back to everybody stays frozen as today's contact list.
 */

/**
 * The allow-list that results from showing or hiding one item for one contact.
 *
 * @param current       the item's stored visibleTo ([] = everyone)
 * @param allIds        every active connection id of the author
 * @param connectionId  the contact being shown or hidden
 * @param show          true to add them, false to remove them
 * @returns a new allow-list; [] when it covers everyone, which restores the
 *          dynamic meaning rather than pinning the audience to today's list
 */
export function nextVisibleTo(current, allIds, connectionId, show) {
  const explicit = !current || current.length === 0 ? [...allIds] : [...current];
  const at = explicit.indexOf(connectionId);

  if (show) {
    if (at === -1) explicit.push(connectionId);
  } else if (at !== -1) {
    explicit.splice(at, 1);
  }

  const coversEveryone = allIds.length > 0 && allIds.every((id) => explicit.includes(id));
  return coversEveryone ? [] : explicit;
}

/**
 * How many other contacts would still see `item` once `connectionId` is
 * removed from its audience.
 *
 * The caller needs this because zero is not a storable state: an empty
 * `visibleTo` would read as "everyone", so hiding the last remaining reader
 * has to be refused (a wall post) or expressed another way (a Know Me entry's
 * `isPublic`) instead of being written as an empty list.
 */
export function othersStillSeeing(item, allIds, connectionId) {
  const explicit =
    !item?.visibleTo || item.visibleTo.length === 0 ? allIds : item.visibleTo;
  return explicit.filter((id) => id !== connectionId).length;
}

/**
 * Whether one contact sees one item, and if not, which reason applies.
 *
 * Mirrors `canView` in profile-audience.js, but reports *why* rather than a
 * boolean — the audience screen exists to let the author correct a choice,
 * which they cannot do if all three reasons collapse into "hidden".
 *
 * The order is deliberate. "audience" is reported ahead of "boundary" because
 * it is the author's own decision and the only one they can reverse; the
 * caller still attaches the blocked topics so the UI can warn that re-adding
 * the contact would not be enough on its own.
 *
 * @returns {{ shown: boolean, reason: null|"private"|"audience"|"boundary" }}
 */
export function visibilityState(item, connectionId) {
  // Only Know Me entries carry isPublic; a wall post has no such column, so
  // `undefined` must not be read as "private".
  if (item?.isPublic === false) {
    return { shown: false, reason: "private" };
  }

  const addressed =
    !item?.visibleTo ||
    item.visibleTo.length === 0 ||
    item.visibleTo.includes(connectionId);
  if (!addressed) {
    return { shown: false, reason: "audience" };
  }

  if ((item?.excludedFrom || []).includes(connectionId)) {
    return { shown: false, reason: "boundary" };
  }

  return { shown: true, reason: null };
}
