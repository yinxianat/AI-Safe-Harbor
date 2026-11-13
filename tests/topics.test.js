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

/**
 * Noise floor for the whole registry.
 *
 * Every keyword added to a topic is a chance to block a message that has
 * nothing to do with it, and the cost falls on two people who will not
 * understand why. This test marks ALL topics red at once — the harshest
 * possible configuration — and asserts that ordinary messages still get
 * through. It is the guard to run when adding a topic or a keyword.
 */
describe("the registry does not block ordinary messages", () => {
  const everythingRed = TOPICS.map((t) => ({ topicName: t.key, comfortLevel: "red" }));

  it.each([
    ["Good morning, I hope you slept well"],
    ["The train is delayed but I am on my way"],
    ["I picked up bread and eggs on the way home"],
    ["Want to watch something tonight?"],
    ["Thank you for yesterday, it meant a lot"],
    ["However I may be a little late"],
    ["There are multiple options for Saturday"],
    ["Just a moment and I will call you back"],
    ["See you at the usual place"],
    ["That made me laugh out loud"],
  ])("lets %j through with every topic marked red", (message) => {
    const result = checkTopicBoundaries(message, everythingRed);
    expect(result.redTopics ?? []).toEqual([]);
    expect(result.allowed).toBe(true);
  });
});

describe("every topic matches its own subject", () => {
  it.each([
    ["health", "I have a doctor appointment tomorrow"],
    ["work", "My boss moved the deadline again"],
    ["money", "The rent went up this year"],
    ["family", "My mom called today"],
    // "close to you" deliberately does not match: the keyword is "closeness",
    // because a bare "close" would fire on "close the door" and "close by".
    ["intimacy", "I miss cuddling with you"],
    ["future_plans", "Where do you see us in five years"],
    ["past_conflicts", "I am still upset about that argument"],
    ["social_life", "My friends want to meet on Friday"],
    ["parenting", "The kids need picking up from school"],
    ["personal_growth", "I joined a gym this week"],
    ["body_and_appearance", "I have gained weight this year"],
    ["grief_and_loss", "The funeral is on Thursday"],
    ["politics_and_beliefs", "Did you see the election results"],
    ["home_and_chores", "The dishes are still in the sink"],
    ["substances_and_habits", "I am three months sober today"],
    ["time_and_attention", "You are always on your phone"],
    ["past_relationships", "My ex called me yesterday"],
  ])("%s catches %j", (topicName, message) => {
    const result = checkTopicBoundaries(message, [{ topicName, comfortLevel: "red" }]);
    expect(result.allowed).toBe(false);
    expect(result.redTopics).toContain(topicName);
  });

  // The list above must stay exhaustive, or a topic added later goes
  // unverified and can ship with keywords that never match anything.
  it("covers every topic in the registry", () => {
    const covered = [
      "health", "work", "money", "family", "intimacy", "future_plans",
      "past_conflicts", "social_life", "parenting", "personal_growth",
      "body_and_appearance", "grief_and_loss", "politics_and_beliefs",
      "home_and_chores", "substances_and_habits", "time_and_attention",
      "past_relationships",
    ];
    expect(new Set(covered)).toEqual(new Set(TOPICS.map((t) => t.key)));
  });
});
