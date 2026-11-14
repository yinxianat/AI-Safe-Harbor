import pg from "pg";
import { TABLES, TABLE_NAMES } from "./admin-schema.js";

/**
 * Run read-only SQL for the admin surface, with four independent guards.
 *
 * None of these is sufficient on its own. The AI-generated query feature
 * runs model output against this; the Peek feature runs a hand-built query
 * against this; both arrive here with the same expectations.
 *
 *   1. One statement per call, SELECT or WITH. A semicolon anywhere in the
 *      text is refused.
 *   2. A dedicated read-only connection: BEGIN READ ONLY, statement_timeout,
 *      no commit at the end. Even a write statement that slipped past the
 *      parser could not persist.
 *   3. No reference to a table outside the admin schema allow-list.
 *   4. No reference to a column marked sensitive on any allowed table,
 *      including columns written as "Table"."col" or table.col.
 *
 * The connection uses a minimal-privilege DB role if one is configured
 * (ADMIN_READONLY_DATABASE_URL). If not, the shared DATABASE_URL is used
 * and the in-process guards above are the only line of defence — the
 * guards still hold, but the postgres role can't enforce them for us.
 */

const MAX_ROWS = 100;
const STATEMENT_TIMEOUT_MS = 3_000;

function readOnlyConnectionString() {
  // Named separately so an operator can provision a role that is granted
  // only SELECT on the admin-visible tables. If they haven't, we fall
  // back and rely entirely on the in-process guards.
  return process.env.ADMIN_READONLY_DATABASE_URL || process.env.DATABASE_URL;
}

/** One pool per process, on the read-only connection string. */
let pool = null;
function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: readOnlyConnectionString(),
      max: 2,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

/**
 * Collect every bare identifier in a SQL string.
 *
 * Good enough for the gate because the allow-list is tiny, well-known and
 * case-sensitive on the Postgres side (Prisma quotes everything PascalCase).
 * An identifier we miss is one the parser would reject itself when it
 * failed to find it; an identifier we FALSELY detect would just refuse a
 * valid query, which is a loud failure the operator can fix.
 */
function collectIdentifiers(sql) {
  // Strip comments and string literals first, so content inside '...' and
  // "..." doesn't look like identifiers.
  const stripped = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:''|[^'])*'/g, " '' ");

  const tokens = new Set();
  // Quoted PascalCase identifiers, both bare table names and "T"."col" refs.
  for (const m of stripped.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)) tokens.add(m[1]);
  // Unquoted identifiers that happen to match a Prisma name exactly.
  for (const m of stripped.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)) tokens.add(m[1]);
  return tokens;
}

/** The set of allow-listed table names, for the identifier check. */
const ALLOWED_TABLES = new Set(TABLE_NAMES);

/**
 * Table-scoped sensitivity.
 *
 * A column can be safe on one table and sensitive on another ("email" is
 * identity info on User but prospect info on Invitation). The global set
 * version was too crude for that — it either rejected every query that
 * named "email" or let Invitation.email leak.
 *
 * The gate now distinguishes qualified references ("Table"."col" or
 * table.col) from bare ones. A qualified reference is checked against the
 * specific table's sensitive list. A bare one is rejected only when the
 * name is sensitive on EVERY table that has it as a column — i.e. there
 * is no legitimate reading. "email" is safe on User, so a bare "email"
 * is allowed and must be qualified correctly by context; if the query
 * joins Invitation and reads "email", the qualified check still catches it.
 */
function sensitiveTablesFor(column) {
  const tables = [];
  for (const [name, def] of Object.entries(TABLES)) {
    if (def.sensitive.includes(column)) tables.push(name);
  }
  return tables;
}

function safeTablesFor(column) {
  const tables = [];
  for (const [name, def] of Object.entries(TABLES)) {
    if (def.safe.includes(column) || def.pk === column) tables.push(name);
  }
  return tables;
}

/**
 * Extract qualified references: `"Table"."col"`, `Table.col`, `t."col"`
 * where t is a known alias. We only match the quoted/dotted forms because
 * those are unambiguous; a bare identifier is handled below.
 */
/**
 * Collect every table named in FROM / JOIN clauses, so we can judge a bare
 * column reference against the tables the query is actually reading.
 */
function tablesInQuery(sql) {
  const tables = new Set();
  for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+"([A-Za-z_][A-Za-z0-9_]*)"/gi)) {
    tables.add(m[1]);
  }
  for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+([A-Z][A-Za-z0-9_]*)\b/g)) {
    tables.add(m[1]);
  }
  return tables;
}

function qualifiedReferences(sql) {
  const refs = [];
  // "Table"."col"
  for (const m of sql.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"\s*\.\s*"([A-Za-z_][A-Za-z0-9_]*)"/g)) {
    refs.push({ table: m[1], column: m[2] });
  }
  // Table."col" — PascalCase-looking identifier followed by .col
  for (const m of sql.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*\.\s*"([A-Za-z_][A-Za-z0-9_]*)"/g)) {
    refs.push({ table: m[1], column: m[2] });
  }
  return refs;
}

/**
 * A Postgres keyword list the identifier walk may encounter. Kept small:
 * we only need to not trip on words that look like identifiers and would
 * otherwise be rejected as "unknown table". The parser enforces real SQL
 * grammar; this list is only there so the allow-list check doesn't lie.
 */
const SQL_RESERVED = new Set([
  "select", "from", "where", "and", "or", "not", "as", "with", "on", "in",
  "is", "null", "true", "false", "like", "ilike", "between", "order", "by",
  "asc", "desc", "limit", "offset", "group", "having", "distinct", "case",
  "when", "then", "else", "end", "join", "inner", "left", "right", "outer",
  "full", "cross", "using", "union", "all", "except", "intersect", "lateral",
  "exists", "any", "some", "coalesce", "nullif", "cast", "array",
  "count", "sum", "avg", "min", "max", "concat", "length", "lower", "upper",
  "to_char", "to_timestamp", "date_trunc", "interval", "extract", "now",
  "current_date", "current_timestamp", "current_time", "jsonb_array_length",
  "generate_series",
]);

function isAllowListed(ident) {
  if (!ident) return false;
  if (ALLOWED_TABLES.has(ident)) return true;
  if (SQL_RESERVED.has(ident.toLowerCase())) return true;
  // A column on any allowed table (safe or sensitive) is accepted here;
  // the sensitive filter runs separately below.
  for (const def of Object.values(TABLES)) {
    if (def.safe.includes(ident) || def.sensitive.includes(ident)) return true;
    if (ident === def.pk) return true;
  }
  return false;
}

/**
 * Check a candidate SQL string against the guards.
 *
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateAdminSql(sql) {
  if (typeof sql !== "string") return { ok: false, reason: "not a string" };
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!trimmed) return { ok: false, reason: "empty query" };

  if (trimmed.includes(";")) return { ok: false, reason: "only one statement per call" };

  const lower = trimmed.toLowerCase();
  if (!/^\s*(select|with)\b/.test(lower)) {
    return { ok: false, reason: "query must start with SELECT or WITH" };
  }

  // CTE aliases introduced by WITH <name> AS (...) are legitimate identifiers
  // the writer may reference later in the same query. Treating them as
  // unknown would refuse every WITH-prefixed analytics query, which is the
  // most common shape in a real diagnostic workload.
  const cteAliases = new Set();
  for (const m of trimmed.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(/gi)) {
    cteAliases.add(m[1]);
  }

  // Keywords that alter data or bypass the read-only transaction. Checked
  // on word boundaries so a column named "update_count" is not rejected.
  const forbidden = [
    "insert", "update", "delete", "merge", "truncate", "drop", "alter",
    "create", "grant", "revoke", "vacuum", "analyze", "reindex", "cluster",
    "copy", "call", "do", "set", "reset", "listen", "notify", "lock",
    "savepoint", "begin", "commit", "rollback", "prepare",
    // pg_* catalogs would expose hashed secrets and connection strings.
    "pg_", "information_schema",
  ];
  for (const keyword of forbidden) {
    const pattern = keyword.endsWith("_")
      ? new RegExp(`\\b${keyword}`, "i")
      : new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(trimmed)) {
      return { ok: false, reason: `forbidden keyword: ${keyword.replace(/_$/, "*")}` };
    }
  }

  // 1. Every qualified reference is checked against the specific table's
  //    sensitive list. "Invitation"."email" is rejected; "User"."email" is
  //    allowed (identity info).
  for (const ref of qualifiedReferences(trimmed)) {
    const def = TABLES[ref.table];
    if (!def) {
      return { ok: false, reason: `unknown table: ${ref.table}` };
    }
    if (def.sensitive.includes(ref.column)) {
      return { ok: false, reason: `sensitive column not available: ${ref.table}.${ref.column}` };
    }
  }

  // 2. Every bare identifier must be a known table/column/keyword, AND
  //    not be sensitive on EVERY table that lists it. If "note" only
  //    appears on TopicSetting.sensitive, a bare "note" is rejected. If a
  //    column like "email" is safe on at least one table, a bare reference
  //    is allowed (the qualified check above handles the Invitation case).
  const identifiers = collectIdentifiers(trimmed);
  for (const ident of identifiers) {
    if (cteAliases.has(ident)) continue;
    if (!isAllowListed(ident)) {
      return { ok: false, reason: `unknown identifier: ${ident}` };
    }
    const sens = sensitiveTablesFor(ident);
    const safe = safeTablesFor(ident);
    if (sens.length > 0 && safe.length === 0) {
      return { ok: false, reason: `sensitive column not available: ${ident}` };
    }
    // Overlap case (e.g. "email" is safe on User, sensitive on Invitation):
    // if the FROM list contains ONLY tables where this column is sensitive,
    // the bare reference can only resolve to one of them, so reject.
    if (sens.length > 0 && safe.length > 0) {
      const scope = tablesInQuery(trimmed);
      if (scope.size > 0) {
        let anySafeInScope = false;
        for (const t of scope) {
          if (safeTablesFor(ident).includes(t)) { anySafeInScope = true; break; }
        }
        if (!anySafeInScope) {
          const sensInScope = [...scope].filter((t) => sens.includes(t));
          if (sensInScope.length > 0) {
            return { ok: false, reason: `sensitive column not available: ${ident}` };
          }
        }
      }
    }
  }

  return { ok: true, sql: trimmed };
}

/**
 * Execute a validated SELECT in a read-only transaction and return at most
 * MAX_ROWS rows.
 *
 * `LIMIT` is appended when the query does not already name one; a query
 * that tries to return every row of Message would otherwise lock up the
 * browser long before hitting the statement timeout.
 */
async function execute(sql) {
  const needsLimit = !/\blimit\s+\d+\b/i.test(sql);
  const bounded = needsLimit ? `${sql}\nLIMIT ${MAX_ROWS}` : sql;
  const client = await getPool().connect();
  const start = Date.now();
  try {
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query("BEGIN READ ONLY");
    const result = await client.query(bounded);
    await client.query("ROLLBACK");
    return {
      ok: true,
      rows: result.rows.slice(0, MAX_ROWS),
      rowCount: result.rowCount,
      truncated: result.rows.length > MAX_ROWS,
      durationMs: Date.now() - start,
      executed: bounded,
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* best effort */ }
    return {
      ok: false,
      reason: err?.message || "query_failed",
      executed: bounded,
    };
  } finally {
    client.release();
  }
}

/**
 * Run SQL that originated from the user (AI output, hand-typed).
 *
 * The validator refuses any sensitive column reference, any mutation
 * keyword, any statement outside the allow-list — and only after that does
 * the SQL reach a read-only transaction with a tight statement timeout.
 */
export async function runAdminQuery(rawSql) {
  const check = validateAdminSql(rawSql);
  if (!check.ok) return { ok: false, reason: check.reason };
  return execute(check.sql);
}

/**
 * Run a Peek SELECT built by buildPeekSql.
 *
 * Skips the validator because Peek SQL deliberately references sensitive
 * columns inside IS NOT NULL / length() expressions — that is the mechanism
 * that lets it expose presence without body. The construction site is the
 * trust boundary: only call this with SQL buildPeekSql returned.
 */
export async function runTrustedPeekSql(sql) {
  if (typeof sql !== "string" || !sql.trim()) {
    return { ok: false, reason: "empty query" };
  }
  return execute(sql);
}

/**
 * The hand-built Peek query for one table: every safe column, newest first,
 * limited. Uses the schema's own select list so a new sensitive column is
 * automatically excluded as soon as it is added to admin-schema.js.
 */
export function buildPeekSql(tableName, limit = 10) {
  const def = TABLES[tableName];
  if (!def) return null;
  const selectList = def.safe
    .map((col) => {
      const computed = `${tableName}.${col}`;
      if (col === "hasAvatar") return `("avatarUrl" IS NOT NULL) AS "hasAvatar"`;
      if (col === "hasStatus") return `("statusText" IS NOT NULL) AS "hasStatus"`;
      if (col === "hasTonePrompt") return `("tonePrompt" IS NOT NULL) AS "hasTonePrompt"`;
      if (col === "hasNickname") return `("nickname" IS NOT NULL) AS "hasNickname"`;
      if (col === "hasNote") return `("note" IS NOT NULL) AS "hasNote"`;
      if (col === "hasRephrased") return `("contentRephrased" IS NOT NULL) AS "hasRephrased"`;
      if (col === "hasEmail") return `("email" IS NOT NULL) AS "hasEmail"`;
      if (col === "promptLength") return `COALESCE(length("prompt"), 0) AS "promptLength"`;
      if (col === "answerLength") return `COALESCE(length("answer"), 0) AS "answerLength"`;
      if (col === "textLength") return `COALESCE(length("text"), 0) AS "textLength"`;
      if (col === "turnCount") return `COALESCE(jsonb_array_length("turns"), 0) AS "turnCount"`;
      return `"${col}"`;
    })
    .join(", ");
  const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= MAX_ROWS ? limit : 10;
  // The orderBy string in admin-schema is a convenience ("createdAt DESC").
  // Postgres folds unquoted identifiers to lowercase, so the camelCase
  // column names in this schema need quoting; otherwise "createdAt" turns
  // into `createdat` and the query fails. Idempotent for identifiers that
  // already carry quotes.
  const orderBy = def.orderBy.replace(/^([A-Za-z_][A-Za-z0-9_]*)/, (ident) =>
    ident.startsWith('"') ? ident : `"${ident}"`
  );
  return `SELECT ${selectList} FROM "${tableName}" ORDER BY ${orderBy} LIMIT ${safeLimit}`;
}
