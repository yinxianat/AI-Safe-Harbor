import { validateEmailShape, suggestCorrection } from "../src/lib/email-hints.js";

describe("Email shape validation", () => {

  test("accepts ordinary addresses", () => {
    for (const email of [
      "a@b.co",
      "alice@example.com",
      "alice.smith+tag@sub.example.co.uk",
      "alice_smith@example-host.com",
    ]) {
      expect(validateEmailShape(email).ok).toBe(true);
    }
  });

  test("normalises case and surrounding whitespace", () => {
    expect(validateEmailShape("  Alice@Example.COM ").email).toBe("alice@example.com");
  });

  // Each message must name what to fix. "Invalid email" tells the user nothing
  // they did not already know.
  test("explains what is wrong, not just that something is", () => {
    expect(validateEmailShape("").message).toMatch(/enter your email/i);
    expect(validateEmailShape("alice").message).toMatch(/needs an @/i);
    expect(validateEmailShape("alice@@example.com").message).toMatch(/more than one @/i);
    expect(validateEmailShape("@example.com").message).toMatch(/before the @/i);
    expect(validateEmailShape("alice@").message).toMatch(/after the @/i);
    expect(validateEmailShape("alice@localhost").message).toMatch(/needs a dot/i);
  });

  test("rejects an over-long address", () => {
    const long = "a".repeat(310) + "@example.com";
    expect(validateEmailShape(long).ok).toBe(false);
  });

  test("handles nullish and non-string input", () => {
    for (const value of [null, undefined, 42, {}]) {
      expect(validateEmailShape(value).ok).toBe(false);
    }
  });
});

describe("Typo suggestion", () => {

  test("catches near-misses on well-known domains", () => {
    expect(suggestCorrection("alice@gmial.com")).toBe("alice@gmail.com");
    expect(suggestCorrection("alice@gmai.com")).toBe("alice@gmail.com");
    expect(suggestCorrection("alice@outlok.com")).toBe("alice@outlook.com");
    expect(suggestCorrection("alice@yaho.com")).toBe("alice@yahoo.com");
  });

  test("stays silent on an address that is already correct", () => {
    expect(suggestCorrection("alice@gmail.com")).toBeNull();
    expect(suggestCorrection("alice@icloud.com")).toBeNull();
  });

  // A wrong suggestion is worse than none: it invites the user to "correct" a
  // perfectly good company address into one that does not exist.
  test("stays silent on unfamiliar domains rather than guessing", () => {
    expect(suggestCorrection("alice@mycompany.com")).toBeNull();
    expect(suggestCorrection("alice@acme-industries.co.uk")).toBeNull();
    expect(suggestCorrection("natasha@leeway.app")).toBeNull();
  });

  test("does not throw on malformed input", () => {
    for (const value of [null, undefined, "", "no-at-sign", "@", "a@"]) {
      expect(() => suggestCorrection(value)).not.toThrow();
    }
  });
});
