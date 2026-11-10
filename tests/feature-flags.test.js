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

  test("companions are enabled", () => {
    expect(isEnabled("companionsEnabled")).toBe(true);
  });

  test("practice pad is enabled", () => {
    expect(isEnabled("practicepadEnabled")).toBe(true);
  });
});
