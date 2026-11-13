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

  test("detects indirect money reference: how much does it make", () => {
    const settings = [{ topicName: "money", comfortLevel: "red" }];
    const result = checkTopicBoundaries("how much does it make", settings);
    expect(result.allowed).toBe(false);
  });

  test("detects indirect money reference: how much is your house worth", () => {
    const settings = [{ topicName: "money", comfortLevel: "red" }];
    const result = checkTopicBoundaries(
      "how much is your house worth",
      settings
    );
    expect(result.allowed).toBe(false);
  });

  test("detects money topic from pay/earn/expensive", () => {
    const settings = [{ topicName: "money", comfortLevel: "red" }];
    expect(checkTopicBoundaries("how much do you earn", settings).allowed).toBe(false);
    expect(checkTopicBoundaries("that's too expensive", settings).allowed).toBe(false);
    expect(checkTopicBoundaries("did you pay for it", settings).allowed).toBe(false);
  });

  test("detects indirect family reference: your parents", () => {
    const settings = [{ topicName: "family", comfortLevel: "red" }];
    const result = checkTopicBoundaries(
      "what do your parents think about it",
      settings
    );
    expect(result.allowed).toBe(false);
  });

  test("detects indirect conflict reference: still upset", () => {
    const settings = [{ topicName: "past_conflicts", comfortLevel: "red" }];
    const result = checkTopicBoundaries("are you still upset about it", settings);
    expect(result.allowed).toBe(false);
  });

  // Regression: a red topic with a user note means the note narrows the rule.
  // The old behavior keyword-blocked anything mentioning "mom" or "son" even
  // when the receiver wrote "in-laws only". With a note, the checker now
  // defers to the AI by returning allowed=true + needsAIReview=true.
  describe("red topics with user notes", () => {
    test("defers a red-with-note match to AI review instead of hard blocking", () => {
      const settings = [
        { topicName: "family", comfortLevel: "red", note: "in-laws only, not other family" },
      ];
      const result = checkTopicBoundaries("my mom just called", settings);
      expect(result.allowed).toBe(true);
      expect(result.needsAIReview).toBe(true);
      expect(result.redTopicsWithNote).toContain("family");
    });

    test("hard-blocks a red topic WITHOUT a note", () => {
      const settings = [{ topicName: "family", comfortLevel: "red" }];
      const result = checkTopicBoundaries("my mom just called", settings);
      expect(result.allowed).toBe(false);
      expect(result.needsAIReview).toBe(false);
    });

    test("empty-string note counts as no note (hard block)", () => {
      const settings = [{ topicName: "family", comfortLevel: "red", note: "   " }];
      const result = checkTopicBoundaries("mom called", settings);
      expect(result.allowed).toBe(false);
    });

    test("mixed: one red hard-block wins over another red with note", () => {
      const settings = [
        { topicName: "family", comfortLevel: "red", note: "in-laws only" },
        { topicName: "money", comfortLevel: "red" },
      ];
      const result = checkTopicBoundaries(
        "my mom wants to buy a gift with her money",
        settings
      );
      // Money is red without a note → hard block, not deferred.
      expect(result.allowed).toBe(false);
      expect(result.needsAIReview).toBe(false);
      expect(result.redTopics).toContain("money");
    });

    test("no keyword match: topic with note is irrelevant", () => {
      const settings = [
        { topicName: "family", comfortLevel: "red", note: "in-laws only" },
      ];
      const result = checkTopicBoundaries("the weather is nice", settings);
      expect(result.allowed).toBe(true);
      expect(result.needsAIReview).toBe(false);
    });

    test("yellow with note still softens, does not defer", () => {
      const settings = [
        { topicName: "family", comfortLevel: "yellow", note: "any family is fine except my mother-in-law" },
      ];
      const result = checkTopicBoundaries("my mom is visiting", settings);
      expect(result.allowed).toBe(true);
      expect(result.needsSoftening).toBe(true);
      expect(result.needsAIReview).toBe(false);
    });
  });
});
