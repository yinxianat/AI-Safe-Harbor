import { detectsCrisis, CRISIS_RESOURCES } from "../src/lib/crisis.js";

/**
 * The detector is the "we noticed this, here is a next step" guard — it
 * runs on every compose and every retry, and the compose result carries
 * a `crisis` flag that lights the resource card.
 *
 * Both halves matter: catching the real ones (false negatives mean
 * someone wrote a cry for help and got no response from the app) AND
 * not blanketing ordinary messages with a hotline card.
 */

describe("detectsCrisis — catches cries for help", () => {
  it.each([
    "I don't want to be here anymore",
    "sometimes I just want to die",
    "I've been thinking about hurting myself",
    "I can't do this, there's no reason to live",
    "I think about suicide a lot lately",
    "He hits me when he drinks",
    "she won't let me leave the house",
    "I'm not safe at home",
    "feeling better off dead honestly",
    "I want to end it all",
  ])("flags %j", (text) => {
    expect(detectsCrisis(text)).toBe(true);
  });

  it.each([
    "我想死",
    "最近不想活了",
    "他打我",
    "我不安全",
    "想伤害自己",
  ])("flags Chinese %j", (text) => {
    expect(detectsCrisis(text)).toBe(true);
  });

  it("flags when the phrase is embedded in a longer sentence", () => {
    expect(
      detectsCrisis(
        "I know it sounds dramatic but honestly I just want to die lately."
      )
    ).toBe(true);
  });
});

describe("detectsCrisis — leaves ordinary messages alone", () => {
  // Negatives are the harder half. The detector must not light the
  // hotline card on everyday expressions of frustration or fatigue.
  it.each([
    "That movie killed me, I laughed for hours",
    "Dying to see you tomorrow",
    "The deadline is killing me, so stressed",
    "I hurt my back at the gym",
    "I'm so tired I could die",
    "She didn't let me finish my sentence",
    "I want to go home soon",
    "Life is a lot right now",
    "我今天好累",
    "今天真的忙死了",
    "我想你",
    "bedtime soon, I'm wiped",
  ])("does not flag %j", (text) => {
    expect(detectsCrisis(text)).toBe(false);
  });

  it.each([
    [""],
    ["   "],
    [null],
    [undefined],
    [42],
  ])("safe on %j", (bad) => {
    expect(detectsCrisis(bad)).toBe(false);
  });
});

describe("CRISIS_RESOURCES", () => {
  it("every entry has the shape the client expects", () => {
    for (const r of CRISIS_RESOURCES) {
      expect(typeof r.id).toBe("string");
      expect(r.labelKey.startsWith("crisis_")).toBe(true);
      expect(r.descriptionKey.startsWith("crisis_")).toBe(true);
      expect(r.url.startsWith("https://")).toBe(true);
    }
  });
});
