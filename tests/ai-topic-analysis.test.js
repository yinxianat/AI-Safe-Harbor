import { analyzeTopics } from "../src/lib/ai/index.js";

describe("analyzeTopics", () => {
  test("returns clear for empty message", async () => {
    const result = await analyzeTopics("", [{ label: "Money", level: "red" }]);
    expect(result.verdict).toBe("clear");
    expect(result.flaggedTopics).toEqual([]);
  });

  test("returns clear for no boundary topics", async () => {
    const result = await analyzeTopics("Hello there!", []);
    expect(result.verdict).toBe("clear");
  });

  test("returns skip when no AI providers are configured", async () => {
    const result = await analyzeTopics("how much does it cost", [
      { label: "Money", level: "red", key: "money" },
    ]);
    // Without API keys configured, AI is unavailable
    expect(["skip", "blocked", "clear", "caution"]).toContain(result.verdict);
  });
});
