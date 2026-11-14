/**
 * The relationship registry: one definition per relationship type, used by
 * the relationship API, the prompt builder and every screen that renders one.
 *
 * Previously the list lived in six places — the API's allow-list, the
 * prompt's hints and four label maps in components — so adding a type meant
 * editing all six, and adding it to five produced a value that saved and then
 * rendered as "Other".
 *
 * `hint` is what the model is told. It describes register, never the people:
 * the safety rules forbid inferring anyone's age, gender or circumstances, so
 * a hint that said "age-appropriate" for `child` was working against them —
 * an adult child is still an adult, and the direction of the relationship is
 * not even recorded (see `DIRECTIONLESS` below).
 */

export const RELATIONSHIPS = [
  {
    key: "spouse",
    labelKey: "rel_spouse",
    hint: "married partner or spouse — the tone can be intimate and affectionate",
  },
  {
    key: "partner",
    labelKey: "rel_partner",
    hint: "long-term partner — the tone can be intimate and affectionate",
  },
  {
    key: "romantic",
    labelKey: "rel_romantic",
    hint: "romantic relationship, dating — the tone can be affectionate, warm and a little tender",
  },
  {
    key: "friend",
    labelKey: "rel_friend",
    hint: "friend — the tone is casual and familiar",
  },
  {
    key: "sibling",
    labelKey: "rel_sibling",
    hint: "sibling — the tone is informal and family-close",
  },
  {
    key: "parent",
    labelKey: "rel_parent",
    hint: "parent and their adult child — the tone is warm and familial, and addresses an adult",
  },
  {
    key: "child",
    labelKey: "rel_child",
    hint: "parent and their adult child — the tone is warm and familial, and addresses an adult",
  },
  {
    key: "coworker",
    labelKey: "rel_coworker",
    hint: "coworker — the tone is friendly but keeps light professional distance",
  },
  {
    key: "roommate",
    labelKey: "rel_roommate",
    hint: "roommate — the tone is practical and casual",
  },
  {
    key: "other",
    labelKey: "rel_other",
    hint: "connection — neutral familiar tone",
  },
];

/**
 * `relationshipType` is one column on the connection, shared by both people,
 * so it cannot say who is the parent and who is the child. `parent` and
 * `child` therefore carry the SAME hint, describing the pair rather than one
 * side. They used to differ, and the `child` hint said "age-appropriate",
 * which pushed the model to write down to whichever adult happened to be
 * reading. Storing a direction per party would be the real fix; until then
 * the hint must not assume one.
 */
export const DIRECTIONLESS = ["parent", "child"];

export const RELATIONSHIP_KEYS = RELATIONSHIPS.map((r) => r.key);

const BY_KEY = Object.fromEntries(RELATIONSHIPS.map((r) => [r.key, r]));

export const DEFAULT_RELATIONSHIP = "other";

export function isValidRelationship(key) {
  // The type check is not redundant: `hasOwnProperty` coerces its key, so an
  // object whose `toString` returns a valid type would otherwise pass.
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(BY_KEY, key);
}

export function sanitizeRelationship(key) {
  return isValidRelationship(key) ? key : DEFAULT_RELATIONSHIP;
}

export function getRelationship(key) {
  return BY_KEY[sanitizeRelationship(key)];
}

/** Translation key for this relationship's label. */
export function relationshipLabelKey(key) {
  return getRelationship(key).labelKey;
}

/** The register description handed to the model; never raw user input. */
export function relationshipHint(key) {
  return getRelationship(key).hint;
}
