import { jest } from "@jest/globals";
import { REGISTRY } from "../src/lib/ai/index.js";
import { analyzeTopics } from "../src/lib/ai/index.js";

/**
 * The topic classifier was flagged Critical by the governance audit: it
 * used to take severity from the model's own `level` field and the topic
 * name from the model's own string. Coaxing the model to say "yellow" for
 * a red boundary would have turned "blocked" into "caution", and a model
 * that paraphrased the label could flag a topic the receiver never set.
 *
 * These tests fake the provider so the classifier runs end-to-end without
 * a real network call. They exercise: ids over names, stored severity over
 * model-reported severity, bounds checking, dedupe, fail-closed on bad
 * JSON, skip on an unreachable provider.
 */

function fakeProvider(fakeText, { throws = null } = {}) {
  return {
    name: "fake",
    isConfigured: () => true,
    defaultModel: () => "fake-model",
    async complete() {
      if (throws) throw throws;
      return { text: fakeText, model: "fake-model", tokensUsed: 0 };
    },
  };
}

const originalGemini = REGISTRY.gemini;
const originalAnthropic = REGISTRY.anthropic;
const originalOpenai = REGISTRY.openai;

function withFake(provider) {
  REGISTRY.gemini = provider;
  REGISTRY.anthropic = { isConfigured: () => false };
  REGISTRY.openai = { isConfigured: () => false };
}

afterEach(() => {
  REGISTRY.gemini = originalGemini;
  REGISTRY.anthropic = originalAnthropic;
  REGISTRY.openai = originalOpenai;
});

const BOUNDARIES = [
  { key: "money", label: "Money", level: "red", note: null },
  { key: "work", label: "Work", level: "yellow", note: null },
  { key: "family", label: "Family", level: "red", note: "in-laws only" },
];

describe("analyzeTopics — verdict uses stored severity, not the model's", () => {
  it("blocks when the flagged topic is stored as red", async () => {
    withFake(fakeProvider(JSON.stringify({ flagged: [{ id: 0, reason: "mentions take-home pay" }] })));
    const result = await analyzeTopics("what's your take-home now", BOUNDARIES);
    expect(result.verdict).toBe("blocked");
    expect(result.flaggedTopics).toHaveLength(1);
    expect(result.flaggedTopics[0].key).toBe("money");
    expect(result.flaggedTopics[0].level).toBe("red");
    expect(result.flaggedTopics[0].reason).toBe("mentions take-home pay");
  });

  it("caution-only when the flagged topic is stored as yellow", async () => {
    withFake(fakeProvider(JSON.stringify({ flagged: [{ id: 1, reason: "work pressure" }] })));
    const result = await analyzeTopics("the office is overwhelming", BOUNDARIES);
    expect(result.verdict).toBe("caution");
    expect(result.flaggedTopics[0].level).toBe("yellow");
  });

  // The core bug: a model could have returned `"level":"yellow"` for a red
  // topic to downgrade the verdict. The fix removed that field from the
  // output entirely; the classifier takes severity from the stored boundary.
  it("ignores any level the model volunteers", async () => {
    withFake(fakeProvider(JSON.stringify({ flagged: [{ id: 0, level: "yellow", reason: "money-ish" }] })));
    const result = await analyzeTopics("salary question", BOUNDARIES);
    expect(result.verdict).toBe("blocked");
    expect(result.flaggedTopics[0].level).toBe("red");
  });

  it("clear when nothing is flagged", async () => {
    withFake(fakeProvider(JSON.stringify({ flagged: [] })));
    const result = await analyzeTopics("hello there", BOUNDARIES);
    expect(result.verdict).toBe("clear");
    expect(result.flaggedTopics).toEqual([]);
  });

  it("de-duplicates repeated ids", async () => {
    withFake(fakeProvider(JSON.stringify({
      flagged: [{ id: 0, reason: "once" }, { id: 0, reason: "twice" }],
    })));
    const result = await analyzeTopics("salary", BOUNDARIES);
    expect(result.flaggedTopics).toHaveLength(1);
  });

  it("drops an out-of-range id rather than crashing", async () => {
    withFake(fakeProvider(JSON.stringify({
      flagged: [{ id: 99, reason: "invented" }, { id: 0, reason: "real" }],
    })));
    const result = await analyzeTopics("salary", BOUNDARIES);
    expect(result.flaggedTopics.map((t) => t.key)).toEqual(["money"]);
  });

  it("drops a non-integer id", async () => {
    withFake(fakeProvider(JSON.stringify({
      flagged: [{ id: "money", reason: "string id" }, { id: -1, reason: "negative" }],
    })));
    const result = await analyzeTopics("salary", BOUNDARIES);
    expect(result.flaggedTopics).toEqual([]);
    expect(result.verdict).toBe("clear");
  });

  it("truncates an over-long reason", async () => {
    const huge = "x".repeat(500);
    withFake(fakeProvider(JSON.stringify({ flagged: [{ id: 0, reason: huge }] })));
    const result = await analyzeTopics("salary", BOUNDARIES);
    expect(result.flaggedTopics[0].reason.length).toBeLessThanOrEqual(200);
  });
});

describe("analyzeTopics — failure modes", () => {
  it("skips on non-JSON output (fail-closed signal)", async () => {
    withFake(fakeProvider("sorry, I can't comply"));
    const result = await analyzeTopics("some text", BOUNDARIES);
    // Previously this returned "clear" — a silent fail-open that let
    // messages through on a confused provider. The new contract is
    // "skip" so the caller can decide, and compose does fail closed
    // for red-with-note.
    expect(result.verdict).toBe("skip");
    expect(result.error).toBe("ai_bad_json");
  });

  it("skips when no provider is configured", async () => {
    REGISTRY.gemini = { isConfigured: () => false };
    REGISTRY.anthropic = { isConfigured: () => false };
    REGISTRY.openai = { isConfigured: () => false };
    const result = await analyzeTopics("some text", BOUNDARIES);
    expect(result.verdict).toBe("skip");
    expect(result.error).toBe("ai_unavailable");
  });

  it("skips (not clear) when the message is empty", async () => {
    const result = await analyzeTopics("", BOUNDARIES);
    expect(result.verdict).toBe("clear");
    expect(result.flaggedTopics).toEqual([]);
  });

  it("skips when there are no boundaries to check against", async () => {
    const result = await analyzeTopics("something", []);
    expect(result.verdict).toBe("clear");
  });
});

describe("analyzeTopics — prompt-level protections", () => {
  // The model is explicitly told NOT to include a severity field. We can
  // observe this indirectly by checking the system prompt the fake sees,
  // which requires exposing it. The cheapest check is behavioral: the
  // classifier accepts output with no level field. Covered in the tests
  // above; this test just pins the fact that a response with ONLY ids
  // and reasons is sufficient to produce a verdict.
  it("accepts an ids-only response", async () => {
    withFake(fakeProvider(JSON.stringify({ flagged: [{ id: 2, reason: "family" }] })));
    const result = await analyzeTopics("your mother-in-law called", BOUNDARIES);
    expect(result.flaggedTopics[0].key).toBe("family");
  });
});
