import {
  pinConfigured,
  verifyPin,
  checkRateLimit,
  recordAttempt,
  clearAttempts,
  __resetAttemptsForTest,
} from "../src/lib/admin-pin.js";

describe("Admin PIN bootstrap", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env = { ...saved, JWT_SECRET: "a-test-jwt-secret-that-is-long-enough-for-hmac" };
    __resetAttemptsForTest();
  });

  afterAll(() => {
    process.env = { ...saved };
    __resetAttemptsForTest();
  });

  // Fail closed. An unset PIN must not leak the fact that this door exists,
  // nor accept the empty string as a valid value.
  describe("pinConfigured", () => {
    test("returns false when ADMIN_PIN is unset", () => {
      delete process.env.ADMIN_PIN;
      expect(pinConfigured()).toBe(false);
    });

    test("returns false for an empty or whitespace PIN", () => {
      process.env.ADMIN_PIN = "";
      expect(pinConfigured()).toBe(false);
    });

    test("rejects PINs shorter than 6 characters", () => {
      process.env.ADMIN_PIN = "12345";
      expect(pinConfigured()).toBe(false);
    });

    test("accepts a PIN of 6 or more characters", () => {
      process.env.ADMIN_PIN = "123456";
      expect(pinConfigured()).toBe(true);
    });
  });

  describe("verifyPin", () => {
    test("rejects any value when ADMIN_PIN is unset", () => {
      delete process.env.ADMIN_PIN;
      expect(verifyPin("anything")).toBe(false);
      expect(verifyPin("")).toBe(false);
    });

    test("rejects non-string input without throwing", () => {
      process.env.ADMIN_PIN = "correct-pin-value";
      for (const v of [null, undefined, 42, {}, []]) {
        expect(verifyPin(v)).toBe(false);
      }
    });

    test("rejects the empty string even when a PIN is set", () => {
      process.env.ADMIN_PIN = "correct-pin-value";
      expect(verifyPin("")).toBe(false);
    });

    test("accepts the exact PIN and nothing else", () => {
      process.env.ADMIN_PIN = "correct-pin-value";
      expect(verifyPin("correct-pin-value")).toBe(true);
      expect(verifyPin("correct-pin-valu")).toBe(false);
      expect(verifyPin("correct-pin-valueX")).toBe(false);
      expect(verifyPin("Correct-Pin-Value")).toBe(false);
    });
  });

  describe("rate limiting", () => {
    test("first five attempts from one IP are allowed", () => {
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit("1.2.3.4").ok).toBe(true);
        recordAttempt("1.2.3.4");
      }
    });

    test("the sixth attempt is blocked with a retry-after", () => {
      for (let i = 0; i < 5; i++) recordAttempt("1.2.3.4");
      const result = checkRateLimit("1.2.3.4");
      expect(result.ok).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    test("attempts from different IPs are tracked separately", () => {
      for (let i = 0; i < 5; i++) recordAttempt("1.2.3.4");
      expect(checkRateLimit("1.2.3.4").ok).toBe(false);
      expect(checkRateLimit("5.6.7.8").ok).toBe(true);
    });

    test("clearAttempts resets the counter for a successful sign-in", () => {
      for (let i = 0; i < 5; i++) recordAttempt("1.2.3.4");
      expect(checkRateLimit("1.2.3.4").ok).toBe(false);
      clearAttempts("1.2.3.4");
      expect(checkRateLimit("1.2.3.4").ok).toBe(true);
    });
  });
});
