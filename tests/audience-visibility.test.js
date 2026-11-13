import {
  nextVisibleTo,
  othersStillSeeing,
  visibilityState,
} from "../src/lib/audience-visibility.js";
import { canView } from "../src/lib/profile-audience.js";

const ALL = ["conn-a", "conn-b", "conn-c"];

describe("nextVisibleTo", () => {
  describe("hiding from one person", () => {
    // The trap this guards: [] means "everyone", so removing one id from an
    // empty list leaves an empty list and hides nothing at all.
    it("spells out everyone else when the audience was everyone", () => {
      expect(nextVisibleTo([], ALL, "conn-b", false).sort()).toEqual(["conn-a", "conn-c"]);
    });

    it("removes one id from an explicit list", () => {
      expect(nextVisibleTo(["conn-a", "conn-b"], ALL, "conn-a", false)).toEqual(["conn-b"]);
    });

    it("leaves an explicit list alone when they were not in it", () => {
      expect(nextVisibleTo(["conn-a"], ALL, "conn-b", false)).toEqual(["conn-a"]);
    });

    // Not storable as an audience: [] would read back as "everyone". The
    // caller has to refuse or use another field, so the arithmetic must make
    // the emptiness visible rather than collapsing it.
    it("returns an empty list when the last reader is removed", () => {
      expect(nextVisibleTo(["conn-a"], ALL, "conn-a", false)).toEqual([]);
    });
  });

  describe("showing to one person", () => {
    it("adds an id to an explicit list", () => {
      expect(nextVisibleTo(["conn-a"], ALL, "conn-b", true).sort()).toEqual(["conn-a", "conn-b"]);
    });

    it("does not duplicate an id already present", () => {
      expect(nextVisibleTo(["conn-a"], ALL, "conn-a", true)).toEqual(["conn-a"]);
    });

    // Re-widening has to restore the dynamic meaning: a list naming all of
    // today's contacts would silently exclude everyone added tomorrow.
    it("collapses back to everyone once the list covers all contacts", () => {
      expect(nextVisibleTo(["conn-a", "conn-b"], ALL, "conn-c", true)).toEqual([]);
    });

    it("leaves everyone as everyone", () => {
      expect(nextVisibleTo([], ALL, "conn-b", true)).toEqual([]);
    });
  });

  it("treats a missing audience the same as everyone", () => {
    expect(nextVisibleTo(undefined, ALL, "conn-b", false).sort()).toEqual(["conn-a", "conn-c"]);
    expect(nextVisibleTo(null, ALL, "conn-b", false).sort()).toEqual(["conn-a", "conn-c"]);
  });

  it("does not claim to cover everyone when there are no contacts", () => {
    expect(nextVisibleTo([], [], "conn-a", false)).toEqual([]);
  });

  it("does not mutate the list it was given", () => {
    const current = ["conn-a", "conn-b"];
    nextVisibleTo(current, ALL, "conn-a", false);
    expect(current).toEqual(["conn-a", "conn-b"]);
  });
});

describe("othersStillSeeing", () => {
  it("counts every other contact when the audience is everyone", () => {
    expect(othersStillSeeing({ visibleTo: [] }, ALL, "conn-a")).toBe(2);
  });

  it("counts only the named contacts of an explicit audience", () => {
    expect(othersStillSeeing({ visibleTo: ["conn-a", "conn-b"] }, ALL, "conn-a")).toBe(1);
  });

  it("returns zero when the contact is the only reader", () => {
    expect(othersStillSeeing({ visibleTo: ["conn-a"] }, ALL, "conn-a")).toBe(0);
  });

  it("returns zero for an everyone-audience with a single contact", () => {
    expect(othersStillSeeing({ visibleTo: [] }, ["conn-a"], "conn-a")).toBe(0);
  });

  it("treats a missing audience as everyone", () => {
    expect(othersStillSeeing({}, ALL, "conn-a")).toBe(2);
  });
});

describe("visibilityState", () => {
  const CONN = "conn-a";

  it("shows an item addressed to everyone", () => {
    expect(visibilityState({ visibleTo: [], excludedFrom: [] }, CONN)).toEqual({
      shown: true,
      reason: null,
    });
  });

  it("shows an item that names this contact", () => {
    expect(visibilityState({ visibleTo: [CONN, "conn-b"] }, CONN).shown).toBe(true);
  });

  it("hides an item that names other contacts only", () => {
    expect(visibilityState({ visibleTo: ["conn-b"] }, CONN)).toEqual({
      shown: false,
      reason: "audience",
    });
  });

  it("hides an item the contact's own boundary withheld", () => {
    expect(visibilityState({ visibleTo: [], excludedFrom: [CONN] }, CONN)).toEqual({
      shown: false,
      reason: "boundary",
    });
  });

  it("reports an entry hidden from everyone as private", () => {
    expect(visibilityState({ isPublic: false, visibleTo: [] }, CONN)).toEqual({
      shown: false,
      reason: "private",
    });
  });

  // A wall post has no isPublic column, so an absent field must not be read
  // as "hidden from everyone".
  it("does not treat a missing isPublic as private", () => {
    expect(visibilityState({ visibleTo: [], excludedFrom: [] }, CONN).shown).toBe(true);
    expect(visibilityState({ isPublic: undefined, visibleTo: [] }, CONN).shown).toBe(true);
  });

  // The author's own choice is the one they can reverse from this screen, so
  // it is the reason worth reporting when both apply.
  it("reports the author's own exclusion ahead of the boundary", () => {
    expect(
      visibilityState({ visibleTo: ["conn-b"], excludedFrom: [CONN] }, CONN).reason
    ).toBe("audience");
  });

  it("agrees with canView on every combination", () => {
    const cases = [
      { visibleTo: [], excludedFrom: [] },
      { visibleTo: [CONN], excludedFrom: [] },
      { visibleTo: ["conn-b"], excludedFrom: [] },
      { visibleTo: [], excludedFrom: [CONN] },
      { visibleTo: [CONN], excludedFrom: [CONN] },
      { visibleTo: ["conn-b"], excludedFrom: [CONN] },
    ];
    for (const item of cases) {
      expect(visibilityState(item, CONN).shown).toBe(canView(item, CONN));
    }
  });

  it("does not throw on a missing item", () => {
    expect(visibilityState(undefined, CONN).shown).toBe(true);
  });
});
