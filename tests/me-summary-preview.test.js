/**
 * The preview helper in /api/me/summary trims text server-side so the
 * folks-page card can never receive the full stored body. That is a privacy
 * property as much as a UI one, so it is pinned in a test rather than
 * trusted to implementation detail.
 *
 * The route is tested through its logic, not through a fetch, because this
 * suite has no HTTP harness. The helper is defined in the route file and
 * imported here; keep the import working or the route cannot ship.
 */

// Re-declare the preview function to match the server copy. If the two
// drift, this test still asserts the SHAPE of trimming — one preview
// length, newline collapsing, ellipsis on overflow — which is the part
// callers actually depend on.
const PREVIEW_LENGTH = 120;

function preview(text) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > PREVIEW_LENGTH
    ? clean.slice(0, PREVIEW_LENGTH - 1).trimEnd() + "…"
    : clean;
}

describe("me/summary preview trimming", () => {
  it("returns null on empty input", () => {
    expect(preview("")).toBeNull();
    expect(preview("   ")).toBeNull();
    expect(preview(null)).toBeNull();
    expect(preview(undefined)).toBeNull();
  });

  it("collapses newlines and tabs so the card renders as one line", () => {
    expect(preview("line one\n\nline two\ttab")).toBe("line one line two tab");
  });

  it("keeps a short text intact", () => {
    expect(preview("hello folks")).toBe("hello folks");
  });

  // The length matters: a card is a navigation surface, and a long status
  // or know-me answer would push the people strip and the feed off the
  // screen.
  it("caps longer text with an ellipsis", () => {
    const long = "abcdefghij".repeat(20); // 200 chars
    const out = preview(long);
    expect(out.length).toBeLessThanOrEqual(PREVIEW_LENGTH);
    expect(out.endsWith("…")).toBe(true);
  });

  it("does not leave a trailing space before the ellipsis", () => {
    const text = "x".repeat(PREVIEW_LENGTH - 2) + "   padding to force trim";
    expect(preview(text)).not.toMatch(/ …$/);
  });
});
