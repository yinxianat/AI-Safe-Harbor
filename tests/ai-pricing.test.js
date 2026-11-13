import { rateFor, estimateCost, summarizeUsage, projectMonthly, RATES_VERIFIED_ON } from "../src/lib/ai/pricing.js";

afterEach(() => {
  delete process.env.AI_PRICE_OVERRIDES;
});

describe("rateFor", () => {
  it("returns a known rate for a listed model", () => {
    const r = rateFor("claude-sonnet-4-5");
    expect(r.known).toBe(true);
    expect(r.inputPerMTok).toBeGreaterThan(0);
    expect(r.outputPerMTok).toBeGreaterThan(r.inputPerMTok);
  });

  // Providers append a date to released model ids; the family rate should
  // still apply rather than silently falling back.
  it("matches a dated model id to its family", () => {
    expect(rateFor("claude-sonnet-4-5-20260101").known).toBe(true);
  });

  it("falls back for an unrecognized model but flags it", () => {
    const r = rateFor("some-model-we-never-heard-of");
    expect(r.known).toBe(false);
    expect(r.inputPerMTok).toBeGreaterThan(0);
  });

  it("falls back for a missing model", () => {
    expect(rateFor(null).known).toBe(false);
  });

  it("lets an env override replace a rate without a deploy", () => {
    process.env.AI_PRICE_OVERRIDES = JSON.stringify({
      "claude-sonnet-4-5": { inputPerMTok: 99, outputPerMTok: 199 },
    });
    expect(rateFor("claude-sonnet-4-5").inputPerMTok).toBe(99);
  });

  it("ignores malformed override JSON instead of throwing", () => {
    process.env.AI_PRICE_OVERRIDES = "{not json";
    expect(() => rateFor("claude-sonnet-4-5")).not.toThrow();
    expect(rateFor("claude-sonnet-4-5").known).toBe(true);
  });

  it("ignores an override missing required numbers", () => {
    process.env.AI_PRICE_OVERRIDES = JSON.stringify({ "gpt-4o": { inputPerMTok: 1 } });
    const r = rateFor("gpt-4o");
    expect(r.inputPerMTok).not.toBe(1);
  });
});

describe("estimateCost", () => {
  it("is zero for zero tokens", () => {
    expect(estimateCost("gpt-4o", 0).usd).toBe(0);
  });

  it("is zero for junk token counts", () => {
    expect(estimateCost("gpt-4o", null).usd).toBe(0);
    expect(estimateCost("gpt-4o", "abc").usd).toBe(0);
  });

  it("scales linearly with tokens", () => {
    const one = estimateCost("gpt-4o", 1_000_000).usd;
    const two = estimateCost("gpt-4o", 2_000_000).usd;
    expect(two).toBeCloseTo(one * 2, 6);
  });

  it("lands between the pure input and pure output price", () => {
    const rate = rateFor("claude-sonnet-4-5");
    const usd = estimateCost("claude-sonnet-4-5", 1_000_000).usd;
    expect(usd).toBeGreaterThan(rate.inputPerMTok);
    expect(usd).toBeLessThan(rate.outputPerMTok);
  });

  it("costs a cheaper model less for the same tokens", () => {
    const cheap = estimateCost("gpt-4o-mini", 1_000_000).usd;
    const dear = estimateCost("gpt-4o", 1_000_000).usd;
    expect(cheap).toBeLessThan(dear);
  });
});

describe("summarizeUsage", () => {
  const calls = [
    { model: "claude-sonnet-4-5", tokens: 1000, userId: "u1" },
    { model: "claude-sonnet-4-5", tokens: 2000, userId: "u1" },
    { model: "gpt-4o", tokens: 3000, userId: "u2" },
  ];

  it("totals tokens and calls", () => {
    const s = summarizeUsage(calls);
    expect(s.totalCalls).toBe(3);
    expect(s.totalTokens).toBe(6000);
    expect(s.totalUsd).toBeGreaterThan(0);
  });

  it("counts distinct users, not calls", () => {
    expect(summarizeUsage(calls).userCount).toBe(2);
  });

  it("derives per-user and per-call averages", () => {
    const s = summarizeUsage(calls);
    expect(s.tokensPerUser).toBe(3000);
    expect(s.tokensPerCall).toBe(2000);
    expect(s.usdPerUser).toBeCloseTo(s.totalUsd / 2, 9);
  });

  it("breaks down by model, most expensive first", () => {
    const s = summarizeUsage(calls);
    expect(s.byModel).toHaveLength(2);
    expect(s.byModel[0].usd).toBeGreaterThanOrEqual(s.byModel[1].usd);
    const sonnet = s.byModel.find((m) => m.model === "claude-sonnet-4-5");
    expect(sonnet.calls).toBe(2);
    expect(sonnet.tokens).toBe(3000);
  });

  it("per-model spend sums to the total", () => {
    const s = summarizeUsage(calls);
    const summed = s.byModel.reduce((a, m) => a + m.usd, 0);
    expect(summed).toBeCloseTo(s.totalUsd, 9);
  });

  // A held or failed message records no model and no tokens. It is still
  // activity, so it should be counted without inventing a cost.
  it("counts a call with no model but adds no cost", () => {
    const s = summarizeUsage([{ model: null, tokens: 0, userId: "u1" }]);
    expect(s.totalCalls).toBe(1);
    expect(s.totalUsd).toBe(0);
    expect(s.byModel[0].model).toBe("unrecorded");
  });

  it("names models costed with the fallback rate", () => {
    const s = summarizeUsage([{ model: "mystery-model", tokens: 1000, userId: "u1" }]);
    expect(s.unknownModels).toContain("mystery-model");
  });

  it("does not flag a zero-token unknown model as costed", () => {
    const s = summarizeUsage([{ model: "mystery-model", tokens: 0, userId: "u1" }]);
    expect(s.unknownModels).toEqual([]);
  });

  it("handles an empty or missing list", () => {
    for (const input of [[], null, undefined]) {
      const s = summarizeUsage(input);
      expect(s.totalCalls).toBe(0);
      expect(s.totalUsd).toBe(0);
      expect(s.usdPerUser).toBe(0);
      expect(s.tokensPerCall).toBe(0);
    }
  });

  it("reports the rate vintage so stale pricing is visible", () => {
    expect(summarizeUsage(calls).ratesVerifiedOn).toBe(RATES_VERIFIED_ON);
  });
});

describe("projectMonthly", () => {
  it("scales a window to 30 days", () => {
    expect(projectMonthly(10, 1)).toBeCloseTo(300, 6);
    expect(projectMonthly(30, 30)).toBeCloseTo(30, 6);
  });

  it("is zero for a zero or junk window", () => {
    expect(projectMonthly(10, 0)).toBe(0);
    expect(projectMonthly(10, null)).toBe(0);
  });
});
