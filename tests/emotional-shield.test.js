import { buildShieldPrompt } from "../src/lib/ai/shield.js";
import {
  EMOTIONS,
  EMOTION_KEYS,
  DEFAULT_SHIELD_EMOTIONS,
  sanitizeEmotions,
  isValidEmotion,
  emotionsForPrompt,
} from "../src/lib/emotions.js";
import { effectiveShield, shieldText, shieldTexts } from "../src/lib/ai/apply-shield.js";

/**
 * The reader-side shield turns on by default, covers a user-chosen list
 * of emotions, and refuses to touch crisis content. These tests lock in
 * that contract — the actual softening is tested in ai-quality — since a
 * prompt edit could quietly remove one of the clauses.
 */

describe("emotions registry", () => {
  it("has a complete set", () => {
    expect(EMOTIONS.length).toBeGreaterThanOrEqual(10);
    for (const e of EMOTIONS) {
      expect(typeof e.key).toBe("string");
      expect(typeof e.labelKey).toBe("string");
      expect(typeof e.markers).toBe("string");
    }
  });

  it("defaults to every emotion on", () => {
    expect([...DEFAULT_SHIELD_EMOTIONS].sort()).toEqual([...EMOTION_KEYS].sort());
  });

  it.each([["nonsense"], [null], [undefined], [""], ["toString"], ["__proto__"]])(
    "rejects %j as a valid emotion",
    (bad) => {
      expect(isValidEmotion(bad)).toBe(false);
    }
  );

  it("sanitizes an input list to known keys only, de-duplicated", () => {
    expect(sanitizeEmotions(["anger", "anger", "nope", null, "stress"])).toEqual([
      "anger",
      "stress",
    ]);
  });

  it("sanitizes a non-array to an empty list", () => {
    expect(sanitizeEmotions(null)).toEqual([]);
    expect(sanitizeEmotions("anger")).toEqual([]);
  });

  it("emotionsForPrompt returns null for an empty list", () => {
    expect(emotionsForPrompt([])).toBeNull();
  });
});

describe("buildShieldPrompt", () => {
  const emotions = ["anger", "stress", "overwhelm"];
  const text = "I'm so sick of this, everything is on fire!!!";

  it("returns null when no emotions are enabled", () => {
    expect(buildShieldPrompt({ emotions: [], rawText: text })).toBeNull();
  });

  it("includes every enabled emotion as a markers line", () => {
    const prompt = buildShieldPrompt({ emotions, rawText: text });
    for (const key of emotions) expect(prompt).toContain(`- ${key}:`);
  });

  /**
   * Self-harm / abuse / danger must pass through unchanged. If this clause
   * ever drifts, a cry for help could be softened into something easy to
   * miss — the worst failure mode this feature has.
   */
  it("names the crisis exception verbatim", () => {
    const prompt = buildShieldPrompt({ emotions, rawText: text });
    expect(prompt).toContain("self-harm");
    expect(prompt).toMatch(/UNCHANGED/);
    expect(prompt.toLowerCase()).toContain("call for help");
  });

  it("forbids adding content the author did not write", () => {
    const prompt = buildShieldPrompt({ emotions, rawText: text });
    expect(prompt).toMatch(/not add comfort|not add.*apology|not add.*affection/i);
  });

  it("tells the model to return text unchanged when nothing matches", () => {
    const prompt = buildShieldPrompt({ emotions, rawText: text });
    expect(prompt).toMatch(/unchanged, character for character/i);
  });

  it("passes the text language into the prompt", () => {
    const prompt = buildShieldPrompt({
      emotions,
      rawText: "我今天压力太大了!!!",
    });
    expect(prompt).toMatch(/Simplified Chinese|same language/i);
  });
});

describe("effectiveShield", () => {
  it("returns null when the user has turned it off", () => {
    expect(
      effectiveShield({ emotionalShield: false, emotionalShieldEmotions: ["anger"] })
    ).toBeNull();
  });

  it("returns null when the user has turned off every emotion", () => {
    expect(
      effectiveShield({ emotionalShield: true, emotionalShieldEmotions: [] })
    ).toBeNull();
  });

  it("returns the emotion list when the shield is active", () => {
    expect(
      effectiveShield({
        emotionalShield: true,
        emotionalShieldEmotions: ["anger", "stress"],
      })
    ).toEqual({ emotions: ["anger", "stress"] });
  });

  it("drops stored emotions that are no longer valid", () => {
    const shield = effectiveShield({
      emotionalShield: true,
      emotionalShieldEmotions: ["anger", "deprecated_feeling", "stress"],
    });
    expect(shield.emotions).toEqual(["anger", "stress"]);
  });

  it("returns null on a missing user row", () => {
    expect(effectiveShield(null)).toBeNull();
    expect(effectiveShield(undefined)).toBeNull();
  });
});

/**
 * shieldText / shieldTexts must fail OPEN. When the shield is off (or the
 * user object is missing the fields), these functions return the original
 * text WITHOUT making a provider call. That's the contract most callers
 * depend on — the feed renders tens of items and must not spend tokens
 * when the reader has turned softening off.
 */
describe("shieldText and shieldTexts short-circuit when shield is off", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = () => {
      throw new Error("fetch must not run when the shield is off");
    };
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const userOff = { emotionalShield: false };
  const userNoEmotions = { emotionalShield: true, emotionalShieldEmotions: [] };

  it("returns the original when the shield is disabled", async () => {
    await expect(shieldText(userOff, "I'm furious")).resolves.toEqual({
      text: "I'm furious",
      softened: false,
    });
  });

  it("returns the originals (not softened) when no emotions are enabled", async () => {
    const out = await shieldTexts(userNoEmotions, ["a", "b", "c"]);
    expect(out).toEqual([
      { text: "a", softened: false },
      { text: "b", softened: false },
      { text: "c", softened: false },
    ]);
  });

  it("returns an empty array for an empty input", async () => {
    await expect(shieldTexts(userOff, [])).resolves.toEqual([]);
  });

  it("returns the original for empty or non-string text without touching the AI", async () => {
    await expect(shieldText({ emotionalShield: true, emotionalShieldEmotions: ["anger"] }, "")).resolves.toEqual({
      text: "",
      softened: false,
    });
  });
});
