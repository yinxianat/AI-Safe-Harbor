import {
  intendedAudience,
  reviewForAudience,
  canView,
  textForViewer,
  pruneVariants,
} from "../src/lib/profile-audience.js";

const red = (topic) => ({ topicName: topic, comfortLevel: "red" });
const yellow = (topic) => ({ topicName: topic, comfortLevel: "yellow" });
const green = (topic) => ({ topicName: topic, comfortLevel: "green" });

const alex = { connectionId: "c-alex", name: "Alex", topicSettings: [green("health")] };
const jordan = { connectionId: "c-jordan", name: "Jordan", topicSettings: [yellow("health")] };
const sam = { connectionId: "c-sam", name: "Sam", topicSettings: [red("health")] };
const contacts = [alex, jordan, sam];

// "doctor" is a health keyword; "pizza" matches no topic.
const HEALTH_TEXT = "I finally saw a doctor about it.";
const NEUTRAL_TEXT = "I really love pizza.";

describe("intendedAudience", () => {
  it("treats an empty list as everyone", () => {
    expect(intendedAudience(contacts, [])).toHaveLength(3);
  });

  it("treats a missing list as everyone", () => {
    expect(intendedAudience(contacts, undefined)).toHaveLength(3);
  });

  it("narrows to the named connections", () => {
    const out = intendedAudience(contacts, ["c-alex", "c-sam"]);
    expect(out.map((c) => c.connectionId)).toEqual(["c-alex", "c-sam"]);
  });

  it("ignores ids that are not contacts", () => {
    expect(intendedAudience(contacts, ["c-nobody"])).toEqual([]);
  });
});

describe("reviewForAudience", () => {
  it("marks everyone clear when no topic is touched", () => {
    const r = reviewForAudience(NEUTRAL_TEXT, contacts, []);
    expect(r.perContact.map((c) => c.status)).toEqual(["clear", "clear", "clear"]);
    expect(r.blocked).toEqual([]);
    expect(r.softened).toEqual([]);
    expect(r.excludedFrom).toEqual([]);
    expect(r.deliverableTo).toHaveLength(3);
    expect(r.blockedEntirely).toBe(false);
  });

  it("judges each contact separately for the same text", () => {
    const r = reviewForAudience(HEALTH_TEXT, contacts, []);
    const byId = Object.fromEntries(r.perContact.map((c) => [c.connectionId, c.status]));
    expect(byId["c-alex"]).toBe("clear");
    expect(byId["c-jordan"]).toBe("gentle");
    expect(byId["c-sam"]).toBe("blocked");
  });

  // The decision this feature turns on: one contact's red topic withholds the
  // note from them, it does not block the post for everyone else.
  it("excludes only the blocked contact and still delivers to the rest", () => {
    const r = reviewForAudience(HEALTH_TEXT, contacts, []);
    expect(r.excludedFrom).toEqual(["c-sam"]);
    expect(r.deliverableTo).toEqual(["c-alex", "c-jordan"]);
    expect(r.blockedEntirely).toBe(false);
  });

  it("names the blocked contact and the topic that blocked them", () => {
    const r = reviewForAudience(HEALTH_TEXT, contacts, []);
    expect(r.blocked).toEqual([
      { connectionId: "c-sam", name: "Sam", redTopics: ["health"] },
    ]);
  });

  it("reports contacts whose tone will be softened", () => {
    const r = reviewForAudience(HEALTH_TEXT, contacts, []);
    expect(r.softened).toEqual([
      { connectionId: "c-jordan", name: "Jordan", yellowTopics: ["health"] },
    ]);
  });

  it("only considers the chosen audience", () => {
    const r = reviewForAudience(HEALTH_TEXT, contacts, ["c-alex"]);
    expect(r.perContact).toHaveLength(1);
    expect(r.blocked).toEqual([]);
    expect(r.deliverableTo).toEqual(["c-alex"]);
  });

  it("flags blockedEntirely when the only recipient blocks it", () => {
    const r = reviewForAudience(HEALTH_TEXT, contacts, ["c-sam"]);
    expect(r.deliverableTo).toEqual([]);
    expect(r.blockedEntirely).toBe(true);
  });

  it("does not flag blockedEntirely when there is no audience at all", () => {
    const r = reviewForAudience(HEALTH_TEXT, [], []);
    expect(r.blockedEntirely).toBe(false);
  });

  it("treats empty text as clear", () => {
    const r = reviewForAudience("   ", contacts, []);
    expect(r.blocked).toEqual([]);
    expect(r.deliverableTo).toHaveLength(3);
  });

  it("surfaces a boundary it could not check rather than calling it clear", () => {
    const mystery = {
      connectionId: "c-mystery",
      name: "Mystery",
      // A red boundary on a topic with no keyword registry entry.
      topicSettings: [{ topicName: "not_a_real_topic", comfortLevel: "red" }],
    };
    const r = reviewForAudience(HEALTH_TEXT, [mystery], []);
    expect(r.perContact[0].unenforceable).toContain("not_a_real_topic");
  });
});

describe("canView", () => {
  it("allows everyone when visibleTo is empty", () => {
    expect(canView({ visibleTo: [], excludedFrom: [] }, "c-alex")).toBe(true);
  });

  it("allows only the named connections", () => {
    const e = { visibleTo: ["c-alex"], excludedFrom: [] };
    expect(canView(e, "c-alex")).toBe(true);
    expect(canView(e, "c-sam")).toBe(false);
  });

  it("lets exclusion override an everyone audience", () => {
    const e = { visibleTo: [], excludedFrom: ["c-sam"] };
    expect(canView(e, "c-alex")).toBe(true);
    expect(canView(e, "c-sam")).toBe(false);
  });

  it("lets exclusion override an explicit allow-list", () => {
    const e = { visibleTo: ["c-sam"], excludedFrom: ["c-sam"] };
    expect(canView(e, "c-sam")).toBe(false);
  });

  it("copes with missing fields", () => {
    expect(canView({}, "c-alex")).toBe(true);
  });
});

describe("textForViewer", () => {
  const entry = { text: "original", variants: { "c-alex": "for alex" } };

  it("returns the approved variant for that viewer", () => {
    expect(textForViewer(entry, "c-alex")).toBe("for alex");
  });

  it("falls back to the original for viewers without a variant", () => {
    expect(textForViewer(entry, "c-sam")).toBe("original");
  });

  it("falls back when there are no variants at all", () => {
    expect(textForViewer({ text: "original" }, "c-alex")).toBe("original");
  });

  it("ignores a blank variant", () => {
    expect(textForViewer({ text: "original", variants: { "c-alex": "  " } }, "c-alex")).toBe("original");
  });

  it("reads a different field when asked", () => {
    expect(textForViewer({ answer: "ans", variants: null }, "c-alex", "answer")).toBe("ans");
  });

  it("ignores a non-object variants value", () => {
    expect(textForViewer({ text: "original", variants: ["nope"] }, "c-alex")).toBe("original");
  });
});

describe("pruneVariants", () => {
  it("drops variants for connections that can no longer read the note", () => {
    const out = pruneVariants({ "c-alex": "a", "c-sam": "s" }, ["c-alex"]);
    expect(out).toEqual({ "c-alex": "a" });
  });

  it("drops blank variants", () => {
    expect(pruneVariants({ "c-alex": "   " }, ["c-alex"])).toBeNull();
  });

  it("returns null when nothing survives", () => {
    expect(pruneVariants({ "c-sam": "s" }, ["c-alex"])).toBeNull();
  });

  it("returns null for junk input", () => {
    expect(pruneVariants(null, ["c-alex"])).toBeNull();
    expect(pruneVariants(["a"], ["c-alex"])).toBeNull();
  });
});
