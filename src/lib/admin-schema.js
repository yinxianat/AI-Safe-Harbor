/**
 * What the admin surface may read, and what it must redact.
 *
 * The product's security promise is that two people write to each other in
 * private. That promise does not stop at the chat UI: the admin board is
 * still a client on the same database. An operator can see schema shape,
 * counts, timestamps, flags and IDs; they can never see message bodies,
 * profile free text, authentication secrets, or anything a user wrote only
 * to one other person.
 *
 * Two surfaces need this registry:
 *   - The "Peek table" quick action lists safe columns and omits sensitive
 *     ones from the SELECT that reaches the DB.
 *   - The AI query feature passes this schema summary to the model as the
 *     only description of the database, so an AI-written query cannot
 *     request a column it was never told about. The runner also enforces
 *     the whitelist after the fact; the prompt is the hint, the runner is
 *     the gate.
 */

/**
 * `safe` is the column list a human may see.
 * `sensitive` lists the columns that exist on the row but must not leave
 * the server. Either the column holds free text a user typed, a secret, or
 * an inline binary (an avatar data URL) that overflows terminals and chat
 * windows.
 *
 * Kept as plain tables so a reviewer can compare it to the Prisma schema
 * on one screen rather than tracing property accessors.
 */
export const TABLES = {
  User: {
    pk: "id",
    orderBy: "createdAt DESC",
    safe: [
      "id", "email", "username", "displayName",
      "tonePreference", "locale", "timezone", "theme",
      "sessionDays", "createdAt",
      // Derived columns the runner adds to make a peek useful without
      // exposing the content itself: "did they write one?", not "what did
      // they write?".
      "hasAvatar", "hasStatus",
    ],
    sensitive: [
      "passwordHash", "avatarUrl", "statusText", "statusMood",
      "statusVisibleTo", "statusUpdatedAt",
    ],
  },
  Connection: {
    pk: "id",
    orderBy: "createdAt DESC",
    safe: [
      "id", "userAId", "userBId", "requestedById",
      "status", "relationshipType", "createdAt",
    ],
    sensitive: [],
  },
  ConnectionPreference: {
    pk: "id",
    orderBy: "id DESC",
    safe: [
      "id", "connectionId", "userId", "tonePreference",
      "softenEmotions", "hasTonePrompt", "hasNickname",
    ],
    // tonePrompt and nickname are both free text the author typed. Boolean
    // "has*" fields replace them so an operator can still see which rows
    // have one set without reading the words.
    sensitive: ["tonePrompt", "nickname"],
  },
  TopicSetting: {
    pk: "id",
    orderBy: "id DESC",
    safe: [
      "id", "connectionId", "userId", "topicName",
      "comfortLevel", "isCustom", "sanitizedLabel",
      "hasNote",
    ],
    sensitive: ["note"],
  },
  TopicDefault: {
    pk: "id",
    orderBy: "id DESC",
    safe: ["id", "userId", "topicName", "comfortLevel", "isCustom", "sanitizedLabel"],
    sensitive: [],
  },
  KnowMeEntry: {
    pk: "id",
    orderBy: "createdAt DESC",
    safe: [
      "id", "userId", "category", "isPublic",
      "sortOrder", "createdAt", "promptLength", "answerLength",
    ],
    // Prompt and answer are self-description; only their presence and
    // length ever reach the admin board.
    sensitive: ["prompt", "answer", "visibleTo", "excludedFrom", "variants"],
  },
  Message: {
    pk: "id",
    orderBy: "createdAt DESC",
    safe: [
      "id", "senderId", "connectionId", "status",
      "heldReason", "topicTags", "aiProvider", "aiModel",
      "aiTokensUsed", "versionSent", "senderApproved",
      "reaction", "reactedAt", "readAt", "sentAt", "createdAt",
      "hasRephrased",
    ],
    // Message bodies are the most sensitive surface in the system. Only
    // the presence of a rewrite reaches the admin board; the text itself,
    // raw or rewritten, never does.
    sensitive: ["contentRaw", "contentRephrased"],
  },
  WallPost: {
    pk: "id",
    orderBy: "createdAt DESC",
    safe: ["id", "userId", "mood", "createdAt", "textLength"],
    sensitive: ["text", "visibleTo", "excludedFrom", "variants"],
  },
  PracticeSession: {
    pk: "id",
    orderBy: "createdAt DESC",
    // Practice sessions store a user rehearsing a hard conversation. Even
    // the topic is personal; count sessions and turns, never read them.
    safe: ["id", "userId", "turnCount", "createdAt", "updatedAt"],
    sensitive: ["topic", "turns"],
  },
  LogEntry: {
    pk: "id",
    orderBy: "lastSeenAt DESC",
    // Logs are meant to be read; this is where diagnostic text lives.
    safe: [
      "id", "fingerprint", "level", "source", "message",
      "detail", "count", "resolved", "resolvedAt", "resolvedBy",
      "firstSeenAt", "lastSeenAt",
    ],
    sensitive: [],
  },
  MagicToken: {
    pk: "id",
    orderBy: "createdAt DESC",
    // Auth material. Nothing at all leaves the row body.
    safe: ["id", "userId", "purpose", "expiresAt", "consumedAt", "createdAt"],
    sensitive: ["tokenHash"],
  },
  Invitation: {
    pk: "id",
    orderBy: "createdAt DESC",
    safe: ["id", "inviterId", "status", "acceptedAt", "expiresAt", "createdAt", "hasEmail"],
    sensitive: ["email", "tokenHash"],
  },
};

export const TABLE_NAMES = Object.keys(TABLES);

/**
 * An expression that computes a safe boolean/length column from a sensitive
 * source, for the Peek query. Everything else is selected as a plain column.
 *
 * The identifiers are hard-coded rather than taken from input: the only way
 * a caller can reach these is through the keys of TABLES.
 */
export const COMPUTED = {
  "User.hasAvatar": `("avatarUrl" IS NOT NULL) AS "hasAvatar"`,
  "User.hasStatus": `("statusText" IS NOT NULL) AS "hasStatus"`,
  "ConnectionPreference.hasTonePrompt": `("tonePrompt" IS NOT NULL) AS "hasTonePrompt"`,
  "ConnectionPreference.hasNickname": `("nickname" IS NOT NULL) AS "hasNickname"`,
  "TopicSetting.hasNote": `("note" IS NOT NULL) AS "hasNote"`,
  "KnowMeEntry.promptLength": `COALESCE(length("prompt"), 0) AS "promptLength"`,
  "KnowMeEntry.answerLength": `COALESCE(length("answer"), 0) AS "answerLength"`,
  "Message.hasRephrased": `("contentRephrased" IS NOT NULL) AS "hasRephrased"`,
  "WallPost.textLength": `COALESCE(length("text"), 0) AS "textLength"`,
  "PracticeSession.turnCount": `COALESCE(jsonb_array_length("turns"), 0) AS "turnCount"`,
  "Invitation.hasEmail": `("email" IS NOT NULL) AS "hasEmail"`,
};

/**
 * The SELECT list for a Peek, built from the safe column set with computed
 * replacements for anything that is a derived column rather than a plain
 * one. Returns a quoted-identifier list for direct interpolation.
 *
 * Returns `null` for an unknown table so callers fail closed.
 */
export function selectListFor(tableName) {
  const def = TABLES[tableName];
  if (!def) return null;
  return def.safe
    .map((col) => COMPUTED[`${tableName}.${col}`] || `"${col}"`)
    .join(", ");
}

/**
 * A terse description of the admin-visible schema, formatted for a prompt.
 *
 * The AI query feature feeds this to the model INSTEAD of the real schema,
 * so the model cannot reference anything it was not told about. The runner
 * still enforces the same rules after the fact — the prompt is the hint,
 * the runner is the gate — so this is a correctness aid, not a security
 * boundary on its own.
 */
export function schemaForPrompt() {
  const lines = [];
  for (const [name, def] of Object.entries(TABLES)) {
    lines.push(`"${name}"(${def.safe.join(", ")})`);
  }
  return lines.join("\n");
}
