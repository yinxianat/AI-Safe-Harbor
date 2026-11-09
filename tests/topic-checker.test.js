import { checkTopicBoundaries } from "../src/lib/topic-checker.js";

describe("Topic Boundary Checker", () => {

  test("allows message about a Green topic", () => {
    const settings = [
      { topicName: "work", comfortLevel: "green" },
      { topicName: "money", comfortLevel: "yellow" },
    ];
    const result = checkTopicBoundaries("I had a great day at work!", settings);
    expect(result.allowed).toBe(true);
  });

  test("allows message with no topic matches", () => {
    const settings = [
      { topicName: "work", comfortLevel: "red" },
    ];
    const result = checkTopicBoundaries("The weather is nice today", settings);
    expect(result.allowed).toBe(true);
  });

  test("holds message about a Red topic", () => {
    const settings = [
      { topicName: "past_conflicts", comfortLevel: "red" },
    ];
    const result = checkTopicBoundaries(
      "Remember that fight we had last Christmas?",
      settings
    );
    expect(result.allowed).toBe(false);
    expect(result.heldReason).toBe("red_topic");
  });

  test("holds message with multiple topics if ANY is Red", () => {
    const settings = [
      { topicName: "work", comfortLevel: "green" },
      { topicName: "money", comfortLevel: "red" },
    ];
    const result = checkTopicBoundaries(
      "My boss gave me a raise at work!",
      settings
    );
    expect(result.allowed).toBe(false);
  });

  test("flags Yellow topic for softening", () => {
    const settings = [
      { topicName: "money", comfortLevel: "yellow" },
    ];
    const result = checkTopicBoundaries(
      "We need to talk about the credit card bill.",
      settings
    );
    expect(result.allowed).toBe(true);
    expect(result.needsSoftening).toBe(true);
    expect(result.yellowTopics).toContain("money");
  });

  test("handles empty message", () => {
    const settings = [
      { topicName: "work", comfortLevel: "red" },
    ];
    const result = checkTopicBoundaries("", settings);
    expect(result.allowed).toBe(true);
  });

  test("handles empty settings (new user, no preferences set)", () => {
    const result = checkTopicBoundaries("I love you!", []);
    expect(result.allowed).toBe(true);
  });

  test("is case-insensitive", () => {
    const settings = [
      { topicName: "money", comfortLevel: "red" },
    ];
    const result = checkTopicBoundaries("MONEY MONEY MONEY", settings);
    expect(result.allowed).toBe(false);
  });

  test("handles special characters in message without crashing", () => {
    const settings = [
      { topicName: "work", comfortLevel: "green" },
    ];
    const result = checkTopicBoundaries(
      'Work is great today! <script>alert("xss")</script>',
      settings
    );
    expect(result.allowed).toBe(true);
  });

  test("detects multiple yellow topics", () => {
    const settings = [
      { topicName: "money", comfortLevel: "yellow" },
      { topicName: "work", comfortLevel: "yellow" },
    ];
    const result = checkTopicBoundaries(
      "I need to talk about my salary at work",
      settings
    );
    expect(result.allowed).toBe(true);
    expect(result.needsSoftening).toBe(true);
    expect(result.yellowTopics.length).toBeGreaterThanOrEqual(1);
  });

  test("red takes priority over yellow for the same message", () => {
    const settings = [
      { topicName: "money", comfortLevel: "yellow" },
      { topicName: "past_conflicts", comfortLevel: "red" },
    ];
    const result = checkTopicBoundaries(
      "We had a fight about money last time",
      settings
    );
    expect(result.allowed).toBe(false);
    expect(result.heldReason).toBe("red_topic");
  });
});
