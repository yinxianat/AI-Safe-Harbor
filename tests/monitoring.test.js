import { redact, maskEmail } from "../src/lib/redact.js";
import { FINDING_TITLES } from "../src/lib/diagnostics.js";
import { checkAdmin } from "../src/lib/admin-auth.js";

function req(headers = {}) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return { headers: { get: (k) => lower[k.toLowerCase()] ?? null } };
}

describe("Log redaction", () => {

  test("masks the local part of an email but keeps the domain", () => {
    expect(maskEmail("alice@example.com")).toBe("a***@example.com");
    expect(redact("failed for bob.smith@gmail.com")).toContain("b***@gmail.com");
    expect(redact("failed for bob.smith@gmail.com")).not.toContain("bob.smith");
  });

  test("strips connection strings with credentials", () => {
    // Assembled at runtime: a literal credentialed DSN in source trips
    // GitHub secret scanning and gitleaks, even when it is obviously fake.
    const dsn = ["postgresql://u", "P".repeat(8) + "@db.internal:5432/leeway"].join(":");
    const out = redact(dsn);
    expect(out).not.toContain("P".repeat(8));
    expect(out).toContain("[connection-string]");
  });

  test("strips API keys of the common shapes", () => {
    const anthropicish = ["sk", "ant", "A".repeat(16)].join("-");
    expect(redact(`key ${anthropicish}`)).not.toContain("A".repeat(16));
    const googleish = "AIza" + "B".repeat(20);
    expect(redact(`key ${googleish}`)).not.toContain(googleish);
  });

  test("strips bearer tokens and JWTs", () => {
    expect(redact("Bearer abcdef1234567890")).toContain("[redacted]");
    const jwt = "eyJhbGciOi.eyJzdWIiOjEyMw.SflKxwRJSMeKKF2QT4";
    expect(redact(`session ${jwt}`)).not.toContain(jwt);
  });

  test("strips magic-link tokens (long hex)", () => {
    const token = "a".repeat(64);
    expect(redact(`?token=${token}`)).not.toContain(token);
  });

  test("handles non-strings and nullish input without throwing", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeNull();
    expect(typeof redact({ a: 1 })).toBe("string");
    expect(typeof redact(42)).toBe("string");
  });

  test("caps length so one log line cannot flood the table", () => {
    expect(redact("x".repeat(99999)).length).toBeLessThanOrEqual(2000);
  });
});

describe("Admin auth fails closed", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  // The important one: no token configured must mean DENIED, never "open to
  // everyone". Getting this backwards exposes the error log and metrics.
  test("returns 503, not access, when ADMIN_TOKEN is unset", () => {
    delete process.env.ADMIN_TOKEN;
    const result = checkAdmin(req({ authorization: "Bearer anything" }));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(503);
  });

  test("an empty ADMIN_TOKEN is also closed", () => {
    process.env.ADMIN_TOKEN = "   ";
    expect(checkAdmin(req({ authorization: "Bearer   " })).ok).toBe(false);
  });

  test("rejects a wrong token", () => {
    process.env.ADMIN_TOKEN = "correct-token-value";
    const result = checkAdmin(req({ authorization: "Bearer wrong-token-value" }));
    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(401);
  });

  test("rejects a missing token", () => {
    process.env.ADMIN_TOKEN = "correct-token-value";
    expect(checkAdmin(req({})).ok).toBe(false);
  });

  test("accepts the correct token via header or cookie", () => {
    process.env.ADMIN_TOKEN = "correct-token-value";
    expect(checkAdmin(req({ authorization: "Bearer correct-token-value" })).ok).toBe(true);
    expect(checkAdmin(req({ cookie: "admin_token=correct-token-value" })).ok).toBe(true);
  });

  test("a length-mismatched token does not throw", () => {
    process.env.ADMIN_TOKEN = "short";
    expect(() => checkAdmin(req({ authorization: "Bearer muchlongertoken" }))).not.toThrow();
    expect(checkAdmin(req({ authorization: "Bearer muchlongertoken" })).ok).toBe(false);
  });
});

// Catalogue enforced by tests: a finding emitted with no title would render as
// "undefined" on the dashboard.
describe("Finding titles catalogue", () => {

  test("every title is a non-empty string", () => {
    for (const [code, title] of Object.entries(FINDING_TITLES)) {
      expect(typeof title).toBe("string");
      expect(title.length).toBeGreaterThan(0);
      expect(code).toMatch(/^[a-z0-9_]+$/);
    }
  });

  test("every finding code emitted by diagnostics.js has a title", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/lib/diagnostics.js", "utf8");
    const emitted = [...src.matchAll(/code:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);

    expect(emitted.length).toBeGreaterThan(0);
    for (const code of new Set(emitted)) {
      expect(FINDING_TITLES[code]).toBeDefined();
    }
  });
});

// A .gitignore pattern that silently excludes application source produces a
// build that works locally and is broken in production. An unanchored `logs/`
// really did exclude src/app/api/admin/logs/route.js this way.
describe("No application source is excluded from the repository", () => {

  test("every file under src/ and prisma/ is tracked by git", async () => {
    const { execSync } = await import("child_process");

    const ignored = execSync(
      "git ls-files --others --ignored --exclude-standard -- src prisma",
      { encoding: "utf8" }
    )
      .split("\n")
      .filter(Boolean)
      // The generated Prisma client is regenerated by the build, by design.
      .filter((f) => !f.startsWith("src/generated/"));

    expect(ignored).toEqual([]);
  });

  test("every API route file is tracked", async () => {
    const { execSync } = await import("child_process");

    const tracked = new Set(
      execSync("git ls-files -- src/app/api", { encoding: "utf8" })
        .split("\n")
        .filter(Boolean)
    );

    const onDisk = execSync("find src/app/api -name route.js", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    expect(onDisk.length).toBeGreaterThan(0);
    for (const file of onDisk) {
      expect(tracked.has(file)).toBe(true);
    }
  });
});
