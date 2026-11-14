import { buildSystemPrompt } from "../src/lib/ai/prompt.js";
import { buildRephraseSettings, appliedSummary } from "../src/lib/receiver-settings.js";

/**
 * The clause is not a vibe — it is a specific set of constraints on the model
 * meant to reduce heated delivery without changing what the sender wrote.
 * These tests pin each limit so a later prompt edit cannot quietly relax them.
 */
describe("emotional softening clause", () => {
  const withSoften = (over = {}) =>
    buildSystemPrompt({ tonePreference: "warm_and_gentle", softenEmotions: true, ...over }, "You NEVER listen!!!");
  const withoutSoften = (over = {}) =>
    buildSystemPrompt({ tonePreference: "warm_and_gentle", softenEmotions: false, ...over }, "You NEVER listen!!!");

  it("appears only when the receiver asked for it", () => {
    expect(withSoften()).toContain("Soften emotional load");
    expect(withoutSoften()).not.toContain("Soften emotional load");
  });

  it("names the delivery markers it rewrites", () => {
    const prompt = withSoften().toLowerCase();
    expect(prompt).toContain("all caps");
    expect(prompt).toMatch(/you always|you never/);
    expect(prompt).toMatch(/insults|name-calling/);
  });

  /**
   * The failure mode to protect against: a "soften" instruction that also
   * strips the sender's position, hides a real problem or adds affection
   * nobody wrote. The clause has to carry those limits itself because it is
   * applied alongside whatever tone is in effect.
   */
  it("forbids changing substance or minimising a real problem", () => {
    const prompt = withSoften().toLowerCase();
    expect(prompt).toMatch(/keep the sender's position.+intact/);
    expect(prompt).toMatch(/not minimise a real problem/);
  });

  it("forbids inventing reassurance, apology or affection", () => {
    expect(withSoften().toLowerCase()).toMatch(
      /not add reassurance, apology, compliments or affection/
    );
  });

  // The clause runs alongside, not instead of, the tone's own guardrail.
  it("does not replace the tone's own guardrail", () => {
    const prompt = withSoften({ tonePreference: "humorous_and_funny" });
    expect(prompt).toContain("No sarcasm");
    expect(prompt).toContain("Soften emotional load");
  });

  it("falls through for unknown values rather than echoing them", () => {
    expect(buildSystemPrompt({ softenEmotions: "yes" }, "hello")).not.toContain("Soften emotional load");
    expect(buildSystemPrompt({ softenEmotions: 1 }, "hello")).not.toContain("Soften emotional load");
  });

  // Chinese parity: the same clause is handed to the model regardless of
  // input language, so the limits apply whichever script the message is in.
  it("appears for a Chinese input too", () => {
    const prompt = buildSystemPrompt(
      { tonePreference: "warm_and_gentle", softenEmotions: true },
      "你从来不听我说话!!!"
    );
    expect(prompt).toContain("Soften emotional load");
    expect(prompt).toContain("Writing in Simplified Chinese");
  });
});

describe("the applied summary reports softening", () => {
  it("reports softeningApplied when the connection asked for it", () => {
    const settings = buildRephraseSettings({
      connection: { relationshipType: "spouse" },
      connPref: { softenEmotions: true },
      boundaryCheck: {},
    });
    expect(appliedSummary(settings).softeningApplied).toBe(true);
  });

  it("reports false when it was not asked for", () => {
    const settings = buildRephraseSettings({
      connection: { relationshipType: "spouse" },
      connPref: {},
      boundaryCheck: {},
    });
    expect(appliedSummary(settings).softeningApplied).toBe(false);
  });

  // Only the flag reaches the sender, not the configuration itself.
  it("carries no free text that could leak the receiver's settings", () => {
    const serialized = JSON.stringify(
      appliedSummary(
        buildRephraseSettings({
          connection: { relationshipType: "spouse" },
          connPref: { softenEmotions: true, tonePrompt: "a private note" },
          boundaryCheck: {},
        })
      )
    );
    expect(serialized).not.toContain("a private note");
  });
});
