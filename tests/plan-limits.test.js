import { effectivePlan, describeQuota, utcMidnight, DAILY_TUNE_CAPS, PROVIDER_FOR_PLAN } from "../src/lib/plan-limits.js";

/**
 * Plan gating has to be honest about four things:
 *   - An expired paid subscription downgrades at request time, regardless
 *     of what the stored plan column says.
 *   - Unknown plans fall back to free, not to any paid tier.
 *   - utcMidnight is actually midnight UTC (not local).
 *   - describeQuota's `used` resets on first call past midnight even if the
 *     counter column still shows the previous day's value.
 *
 * consumeTuneQuota writes to the DB, so it's tested separately via
 * integration tests (not here).
 */

describe("effectivePlan", () => {
  it("returns free for a free user", () => {
    expect(effectivePlan({ plan: "free" })).toBe("free");
  });

  it("returns plus for an active plus user", () => {
    const tomorrow = new Date(Date.now() + 86400_000);
    expect(effectivePlan({ plan: "plus", subscriptionExpiresAt: tomorrow })).toBe("plus");
  });

  it("downgrades plus to free when the subscription expired", () => {
    // Apple's expiration webhook can arrive late. This gate catches
    // lapsed subs at request time so the free-tier cap is enforced.
    const yesterday = new Date(Date.now() - 86400_000);
    expect(effectivePlan({ plan: "plus", subscriptionExpiresAt: yesterday })).toBe("free");
  });

  it("accepts plus without an expiry (lifetime grant)", () => {
    // If we ever hand out a paid plan without an expiry (admin grant,
    // comp), the gate shouldn't downgrade it.
    expect(effectivePlan({ plan: "plus", subscriptionExpiresAt: null })).toBe("plus");
  });

  it("falls back to free on an unknown plan string", () => {
    expect(effectivePlan({ plan: "enterprise-ultra" })).toBe("free");
  });

  it.each([[null], [undefined], [{}]])("safe on %j", (user) => {
    expect(effectivePlan(user)).toBe("free");
  });
});

describe("utcMidnight", () => {
  it("returns a Date with H/M/S/ms zeroed in UTC", () => {
    const ref = new Date("2026-11-14T15:42:07.123Z");
    const m = utcMidnight(ref);
    expect(m.getUTCFullYear()).toBe(2026);
    expect(m.getUTCMonth()).toBe(10); // November
    expect(m.getUTCDate()).toBe(14);
    expect(m.getUTCHours()).toBe(0);
    expect(m.getUTCMinutes()).toBe(0);
  });

  it("defaults to now", () => {
    const m = utcMidnight();
    expect(m.getUTCHours()).toBe(0);
  });
});

describe("describeQuota", () => {
  it("reports plan caps correctly", () => {
    const now = new Date();
    const q = describeQuota({ plan: "plus", tunesUsedToday: 10, tunesUsedTodayResetAt: now });
    expect(q.plan).toBe("plus");
    expect(q.cap).toBe(DAILY_TUNE_CAPS.plus);
    expect(q.used).toBe(10);
    expect(q.remaining).toBe(DAILY_TUNE_CAPS.plus - 10);
  });

  it("resets used to 0 when the reset marker is from a previous day", () => {
    // The lazy reset only writes on the next real call. describeQuota has
    // to agree with that: if the stored counter is stale, report 0 used.
    const twoDaysAgo = new Date(Date.now() - 2 * 86400_000);
    const q = describeQuota({ plan: "free", tunesUsedToday: 99, tunesUsedTodayResetAt: twoDaysAgo });
    expect(q.used).toBe(0);
    expect(q.remaining).toBe(DAILY_TUNE_CAPS.free);
  });

  it("downgrades an expired paid user to the free cap", () => {
    const yesterday = new Date(Date.now() - 86400_000);
    const q = describeQuota({
      plan: "pro",
      subscriptionExpiresAt: yesterday,
      tunesUsedToday: 0,
      tunesUsedTodayResetAt: new Date(),
    });
    expect(q.plan).toBe("free");
    expect(q.cap).toBe(DAILY_TUNE_CAPS.free);
  });
});

describe("PROVIDER_FOR_PLAN", () => {
  it("routes free users to gemini only", () => {
    // Keeping the free tier on Gemini Flash protects unit economics
    // even if a premium model joins the chain later. Pin the rule so a
    // refactor can't accidentally promote free to the full chain.
    expect(PROVIDER_FOR_PLAN.free).toBe("gemini");
  });

  it("gives paid tiers the full chain", () => {
    expect(PROVIDER_FOR_PLAN.plus).toBe("any");
    expect(PROVIDER_FOR_PLAN.pro).toBe("any");
  });
});
