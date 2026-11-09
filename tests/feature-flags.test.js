import { isEnabled } from "../src/lib/feature-flags.js";

describe("Feature Flags", () => {

  test("payments are disabled in testing", () => {
    expect(isEnabled("paymentsEnabled")).toBe(false);
  });

  test("tone tuner is enabled", () => {
    expect(isEnabled("toneTunerEnabled")).toBe(true);
  });

  test("unknown flag returns false", () => {
    expect(isEnabled("nonExistentFlag")).toBe(false);
  });

  test("companions are disabled (Phase 2)", () => {
    expect(isEnabled("companionsEnabled")).toBe(false);
  });

  test("practice pad is disabled (Phase 2)", () => {
    expect(isEnabled("practicepadEnabled")).toBe(false);
  });
});
