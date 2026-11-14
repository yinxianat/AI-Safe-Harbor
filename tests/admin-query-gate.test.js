import { validateAdminSql, buildPeekSql } from "../src/lib/admin-query.js";
import { TABLES, schemaForPrompt } from "../src/lib/admin-schema.js";

/**
 * The admin-query gate is the one place an AI-generated SQL string touches
 * the real database. These tests lock in the three properties it promises:
 *
 *   1. Only a single SELECT/WITH may pass.
 *   2. No sensitive column names appear in the query — the UI never
 *      receives message bodies, free-text notes, or auth secrets.
 *   3. No reference to a table outside the admin schema allow-list, which
 *      stops a model from naming internal catalogs (pg_*, information_schema)
 *      or any table we deliberately did not surface.
 *
 * Both halves are tested: an injected mutation must be rejected, AND a
 * legitimate analytics query must pass. A gate that rejects everything is
 * secure but useless.
 */

describe("validateAdminSql — refusals", () => {
  // The gate has multiple checks (grammar prefix, single-statement, keyword
  // blocklist, identifier allow-list, sensitive-column blocklist). The order
  // of which fires first is implementation detail; what matters is that each
  // mutation attempt is rejected.
  it.each([
    [`INSERT INTO "User" (id) VALUES ('x')`],
    [`UPDATE "User" SET "email"='x'`],
    [`DELETE FROM "User"`],
    [`DROP TABLE "User"`],
    [`TRUNCATE "User"`],
    [`ALTER TABLE "User" ADD COLUMN x TEXT`],
    [`CREATE INDEX "i" ON "User"(id)`],
    [`GRANT SELECT ON "User" TO x`],
    [`SET statement_timeout = 0`],
    [`BEGIN; SELECT 1 FROM "User"`],
    [`VACUUM "User"`],
    [`COPY "User" TO '/tmp/x'`],
  ])("refuses %j", (sql) => {
    const result = validateAdminSql(sql);
    expect(result.ok).toBe(false);
  });

  it("refuses more than one statement", () => {
    const result = validateAdminSql(`SELECT 1 FROM "User"; SELECT 2 FROM "User"`);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/one statement/);
  });

  it("refuses a query that does not start with SELECT or WITH", () => {
    expect(validateAdminSql("EXPLAIN SELECT * FROM \"User\"").ok).toBe(false);
  });

  it("refuses catalog access (pg_*)", () => {
    expect(validateAdminSql('SELECT "rolname" FROM "pg_roles"').ok).toBe(false);
  });

  it("refuses information_schema", () => {
    expect(validateAdminSql(`SELECT * FROM "information_schema"."tables"`).ok).toBe(false);
  });

  it("refuses an unknown table", () => {
    const result = validateAdminSql(`SELECT 1 FROM "Secrets"`);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown identifier/i);
  });

  // The crown-jewels check: every column marked sensitive is refused, by
  // name, no matter the SELECT shape. This is what stops an AI (or a human
  // typing SQL by hand) from asking for message bodies or password hashes.
  describe("refuses every sensitive column name", () => {
    // A column sensitive on SOME table is "wholly sensitive" when it is
    // safe on NO table. Those must be refused as bare identifiers
    // regardless of which table the FROM names. "email" is left out
    // because it is safe on User, so the gate judges it in scope (see
    // the overlap tests below).
    const wholly = [...new Set(Object.values(TABLES).flatMap((t) => t.sensitive))]
      .filter((col) => !Object.values(TABLES).some((def) => def.safe.includes(col) || def.pk === col));
    it.each(wholly.map((c) => [c]))("refuses column %j", (col) => {
      const result = validateAdminSql(`SELECT "${col}" FROM "Message"`);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/sensitive column/i);
    });

    // Overlap: "email" is identity info on User and prospect info on
    // Invitation. The qualified form and the FROM-scope form both apply.
    it("refuses a qualified sensitive reference even when the bare name is safe elsewhere", () => {
      expect(validateAdminSql(`SELECT "Invitation"."email" FROM "Invitation"`).ok).toBe(false);
    });
    it("refuses a bare sensitive reference when the FROM list contains only sensitive-on tables", () => {
      expect(validateAdminSql(`SELECT "email" FROM "Invitation"`).ok).toBe(false);
    });
    it("allows a bare safe reference when the FROM contains a safe-on table", () => {
      expect(validateAdminSql(`SELECT "email" FROM "User"`).ok).toBe(true);
    });

    it("refuses sensitive column named through its table", () => {
      expect(validateAdminSql(`SELECT "Message"."contentRaw" FROM "Message"`).ok).toBe(false);
    });

    it("refuses sensitive column inside an expression", () => {
      expect(validateAdminSql(`SELECT length("contentRaw") FROM "Message"`).ok).toBe(false);
    });
  });
});

describe("validateAdminSql — accepts", () => {
  it.each([
    [`SELECT "aiModel", count(*) FROM "Message" WHERE "createdAt" > now() - interval '7 days' GROUP BY "aiModel"`],
    [`SELECT count(*) FROM "User"`],
    [`WITH active AS (SELECT "id" FROM "Connection" WHERE "status" = 'active') SELECT count(*) FROM active`],
    [`SELECT "topicName", count(*) FROM "TopicSetting" WHERE "comfortLevel" = 'red' GROUP BY "topicName" ORDER BY count(*) DESC LIMIT 20`],
    // Trailing semicolon is stripped and the query still runs.
    [`SELECT count(*) FROM "Message";`],
  ])("accepts %j", (sql) => {
    const result = validateAdminSql(sql);
    expect(result.ok).toBe(true);
  });

  it("returns the sql with trailing semicolons removed", () => {
    expect(validateAdminSql(`SELECT 1 FROM "User";`).sql).toBe(`SELECT 1 FROM "User"`);
  });
});

describe("buildPeekSql", () => {
  it("returns null for an unknown table", () => {
    expect(buildPeekSql("Nope")).toBeNull();
  });

  it("builds a SELECT against each allow-listed table", () => {
    for (const name of Object.keys(TABLES)) {
      const sql = buildPeekSql(name);
      expect(sql).toMatch(/^SELECT /);
      expect(sql).toContain(`FROM "${name}"`);
      expect(sql).toMatch(/LIMIT \d+/);
    }
  });

  // Peek SQL is run by runTrustedPeekSql and bypasses the user-input
  // validator (see src/lib/admin-query.js). It legitimately references
  // sensitive columns INSIDE length()/IS NOT NULL — the mechanism that
  // exposes presence without body. The real test of its safety is below:
  // no bare sensitive column in the SELECT list.

  it("never exposes a sensitive column as its own SELECT item", () => {
    // Parse the SELECT list and assert each bare quoted column is a safe
    // column. Expressions like `("note" IS NOT NULL) AS "hasNote"` are fine
    // because the alias ("hasNote") is what reaches the UI.
    for (const [name, def] of Object.entries(TABLES)) {
      const sql = buildPeekSql(name);
      const selectList = sql.slice("SELECT ".length, sql.indexOf(" FROM "));
      const items = selectList.split(/,(?![^()]*\))/).map((s) => s.trim());
      for (const item of items) {
        // Bare quoted identifier, e.g. `"id"` or `"createdAt"`.
        const bare = item.match(/^"([A-Za-z_][A-Za-z0-9_]*)"$/);
        if (bare) {
          expect(def.safe).toContain(bare[1]);
          expect(def.sensitive).not.toContain(bare[1]);
          continue;
        }
        // Aliased expression: the alias is the exposed column.
        const alias = item.match(/\bAS\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*$/);
        expect(alias).not.toBeNull();
        if (alias) expect(def.sensitive).not.toContain(alias[1]);
      }
    }
  });

  it("caps the limit", () => {
    expect(buildPeekSql("User", 99999)).toContain("LIMIT 10"); // default when oversize
  });
});

describe("schemaForPrompt", () => {
  // The prompt handed to the model must describe only safe columns. If a
  // sensitive column leaked in, the AI would learn it existed and try to
  // query it; the runner would still refuse, but we'd be giving the AI the
  // target it has no legitimate reason to see.
  it("does not name a wholly-sensitive column as a bare identifier", () => {
    // A column is "wholly sensitive" when no table lists it as safe.
    // A column that is safe on some table and sensitive on another
    // ("email": safe on User, sensitive on Invitation) legitimately
    // appears in the prompt — the gate uses qualified references and
    // FROM scope to make the final call.
    const text = schemaForPrompt();
    const wholly = [...new Set(Object.values(TABLES).flatMap((t) => t.sensitive))]
      .filter((col) => !Object.values(TABLES).some((def) => def.safe.includes(col) || def.pk === col));
    for (const col of wholly) {
      const pattern = new RegExp(`[(,\\s]${col}[),\\s]`);
      expect(text).not.toMatch(pattern);
    }
  });

  it("names every allow-listed table", () => {
    const text = schemaForPrompt();
    for (const name of Object.keys(TABLES)) {
      expect(text).toContain(`"${name}"`);
    }
  });
});
