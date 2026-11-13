import {
  describeMessageReason,
  summarizeReasons,
  REASON_CATEGORIES,
} from "../src/lib/message-reasons.js";

describe("describeMessageReason", () => {
  it("names the topics behind a boundary hold", () => {
    const reason = describeMessageReason({
      status: "held",
      heldReason: "red_topic",
      topicTags: ["money"],
    });
    expect(reason.code).toBe("red_topic");
    expect(reason.category).toBe(REASON_CATEGORIES.BOUNDARY);
    expect(reason.detail.toLowerCase()).toContain("money");
  });

  // The distinction the admin board exists to make: a boundary hold is the
  // product working, so counting it as something to fix produces a number no
  // operator can act on.
  it("does not ask the operator to act on a boundary hold", () => {
    expect(
      describeMessageReason({ status: "held", heldReason: "red_topic", topicTags: [] }).actionable
    ).toBe(false);
  });

  it("still explains a boundary hold with no recorded topics", () => {
    const reason = describeMessageReason({ status: "held", heldReason: "red_topic" });
    expect(reason.code).toBe("red_topic");
    expect(reason.detail.length).toBeGreaterThan(0);
  });

  it("treats a failed chain as actionable", () => {
    const reason = describeMessageReason({ status: "draft", heldReason: "ai_failed" });
    expect(reason.code).toBe("ai_failed");
    expect(reason.category).toBe(REASON_CATEGORIES.AI);
    expect(reason.actionable).toBe(true);
  });

  it("separates a provider refusal from an unreachable chain", () => {
    const refused = describeMessageReason({
      status: "draft",
      heldReason: "content_refused",
      aiProvider: "gemini",
    });
    expect(refused.code).toBe("content_refused");
    expect(refused.detail).toContain("gemini");
    expect(refused.code).not.toBe(
      describeMessageReason({ status: "draft", heldReason: "ai_failed" }).code
    );
  });

  describe("drafts with no held reason", () => {
    // A rewritten draft is not a fault: it is a message whose author has not
    // tapped send. Reporting it as a failure made every healthy queue look
    // like an outage.
    it("reads a rewritten draft as waiting for its author", () => {
      const reason = describeMessageReason({
        status: "draft",
        heldReason: null,
        contentRephrased: true,
      });
      expect(reason.code).toBe("awaiting_sender_approval");
      expect(reason.category).toBe(REASON_CATEGORIES.USER);
      expect(reason.actionable).toBe(false);
    });

    it("flags a draft with neither a rewrite nor a reason", () => {
      const reason = describeMessageReason({
        status: "draft",
        heldReason: null,
        contentRephrased: false,
      });
      expect(reason.code).toBe("draft_without_rewrite");
      expect(reason.actionable).toBe(true);
    });
  });

  it("flags a hold with no stored reason", () => {
    const reason = describeMessageReason({ status: "held", heldReason: null });
    expect(reason.code).toBe("held_without_reason");
    expect(reason.actionable).toBe(true);
  });

  it("reports a sent message as delivered", () => {
    expect(describeMessageReason({ status: "sent", heldReason: null }).code).toBe("sent");
  });

  it("does not throw on an unknown state", () => {
    const reason = describeMessageReason({ status: "quarantined", heldReason: "mystery" });
    expect(reason.code).toBe("unknown");
    expect(reason.label).toContain("mystery");
  });

  it("does not throw on a missing message", () => {
    expect(describeMessageReason(undefined).code).toBe("unknown");
  });
});

describe("summarizeReasons", () => {
  it("groups by reason, most frequent first", () => {
    const rows = summarizeReasons([
      { status: "held", heldReason: "red_topic", topicTags: ["money"] },
      { status: "held", heldReason: "red_topic", topicTags: ["health"] },
      { status: "draft", heldReason: "ai_failed" },
    ]);
    expect(rows[0].code).toBe("red_topic");
    expect(rows[0].count).toBe(2);
    expect(rows[1].code).toBe("ai_failed");
    expect(rows[1].count).toBe(1);
  });

  it("marks only the rows an operator can act on", () => {
    const rows = summarizeReasons([
      { status: "held", heldReason: "red_topic", topicTags: [] },
      { status: "draft", heldReason: null, contentRephrased: true },
      { status: "draft", heldReason: "ai_failed" },
    ]);
    const attention = rows.filter((r) => r.needsAttention).map((r) => r.code);
    expect(attention).toEqual(["ai_failed"]);
  });

  it("returns nothing for an empty set", () => {
    expect(summarizeReasons([])).toEqual([]);
  });
});
