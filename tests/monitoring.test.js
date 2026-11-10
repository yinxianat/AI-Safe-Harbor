import { redact, maskEmail } from "../src/lib/redact.js";
import { FINDING_TITLES } from "../src/lib/diagnostics.js";
import { getAdminEmails, isAdminEmail } from "../src/lib/admin-auth.js";

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

describe("Admin role by email", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  // The important one: an empty list must mean NOBODY is an admin, never
  // everybody. Getting this backwards publishes the error log and metrics.
  test("no ADMIN_EMAILS means nobody is an admin", () => {
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
    expect(isAdminEmail("anyone@example.com")).toBe(false);
  });

  test("an empty or whitespace list is still closed", () => {
    for (const value of ["", "   ", ",,,", " , , "]) {
      process.env.ADMIN_EMAILS = value;
      expect(getAdminEmails()).toEqual([]);
      expect(isAdminEmail("anyone@example.com")).toBe(false);
    }
  });

  test("recognises an address on the list", () => {
    process.env.ADMIN_EMAILS = "alice@example.com,bob@example.com";
    expect(isAdminEmail("alice@example.com")).toBe(true);
    expect(isAdminEmail("bob@example.com")).toBe(true);
  });

  test("rejects an address not on the list", () => {
    process.env.ADMIN_EMAILS = "alice@example.com";
    expect(isAdminEmail("eve@example.com")).toBe(false);
  });

  // Casing and padding must not let someone in, nor lock a real admin out.
  test("comparison is case-insensitive and trims whitespace", () => {
    process.env.ADMIN_EMAILS = "  Alice@Example.COM , bob@example.com  ";
    expect(isAdminEmail("alice@example.com")).toBe(true);
    expect(isAdminEmail("ALICE@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("  alice@example.com  ")).toBe(true);
    expect(isAdminEmail("BOB@example.com")).toBe(true);
  });

  test("ignores malformed entries rather than trusting them", () => {
    process.env.ADMIN_EMAILS = "not-an-email,alice@example.com,also bad";
    expect(getAdminEmails()).toEqual(["alice@example.com"]);
    expect(isAdminEmail("not-an-email")).toBe(false);
  });

  test("deduplicates repeated entries", () => {
    process.env.ADMIN_EMAILS = "a@x.com,A@X.com, a@x.com";
    expect(getAdminEmails()).toEqual(["a@x.com"]);
  });

  test("non-string input does not throw", () => {
    process.env.ADMIN_EMAILS = "alice@example.com";
    for (const v of [null, undefined, 42, {}, []]) {
      expect(isAdminEmail(v)).toBe(false);
    }
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

  // Asks whether each route COULD be committed, not whether it already has
  // been. A brand-new route is untracked until it is staged, which is normal;
  // an *ignored* route is the real defect, because `git add -A` skips it and
  // the endpoint 404s in production while working perfectly in development.
  // That is exactly how an unanchored `logs/` pattern hid an admin route.
  test("no API route file is excluded by gitignore", async () => {
    const { execSync } = await import("child_process");

    const onDisk = execSync("find src/app/api -name route.js", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    expect(onDisk.length).toBeGreaterThan(0);

    // check-ignore exits 1 when nothing matches, which is the passing case.
    let ignoredRoutes = "";
    try {
      ignoredRoutes = execSync("git check-ignore -- " + onDisk.join(" "), {
        encoding: "utf8",
      });
    } catch {
      ignoredRoutes = "";
    }

    expect(ignoredRoutes.split("\n").filter(Boolean)).toEqual([]);
  });
});
