import { TOPICS, TOPIC_KEYS, isValidTopicKey, getTopicLabel } from "../src/lib/topics.js";
import { checkTopicBoundaries } from "../src/lib/topic-checker.js";

describe("Topic registry", () => {

  // The guard that matters: a topic offered to users but missing keywords
  // would be accepted as a Red boundary and then silently never enforced.
  test("every topic has a non-empty keyword list", () => {
    for (const topic of TOPICS) {
      expect(Array.isArray(topic.keywords)).toBe(true);
      expect(topic.keywords.length).toBeGreaterThan(0);
    }
  });

  test("every topic has a key and a human label", () => {
    for (const topic of TOPICS) {
      expect(typeof topic.key).toBe("string");
      expect(topic.key.length).toBeGreaterThan(0);
      expect(typeof topic.label).toBe("string");
      expect(topic.label.length).toBeGreaterThan(0);
    }
  });

  test("topic keys are unique", () => {
    expect(new Set(TOPIC_KEYS).size).toBe(TOPIC_KEYS.length);
  });

  test("every registered topic is enforceable by the checker", () => {
    for (const topic of TOPICS) {
      const probe = topic.keywords[0];
      const result = checkTopicBoundaries(probe, [
        { topicName: topic.key, comfortLevel: "red" },
      ]);
      expect(result.allowed).toBe(false);
      expect(result.heldReason).toBe("red_topic");
    }
  });

  test("rejects unknown topic keys", () => {
    expect(isValidTopicKey("money")).toBe(true);
    expect(isValidTopicKey("not_a_topic")).toBe(false);
    expect(isValidTopicKey("")).toBe(false);
  });

  test("falls back to the key when no label exists", () => {
    expect(getTopicLabel("money")).toBe("Money");
    expect(getTopicLabel("unknown_key")).toBe("unknown_key");
  });
});

describe("Unenforceable boundaries are surfaced, not silently ignored", () => {

  test("an unknown Red topic is reported as unenforceable", () => {
    const result = checkTopicBoundaries("anything at all", [
      { topicName: "religion", comfortLevel: "red" },
    ]);
    expect(result.unenforceable).toContain("religion");
  });

  test("an unknown Green topic is not reported (nothing to enforce)", () => {
    const result = checkTopicBoundaries("anything at all", [
      { topicName: "religion", comfortLevel: "green" },
    ]);
    expect(result.unenforceable).toEqual([]);
  });

  test("known topics never appear as unenforceable", () => {
    const result = checkTopicBoundaries("lets talk about money", [
      { topicName: "money", comfortLevel: "red" },
    ]);
    expect(result.unenforceable).toEqual([]);
    expect(result.allowed).toBe(false);
  });
});
