import { rephraseMessage } from "../src/lib/ai/index.js";
import { callJudge } from "./helpers/ai-judge.js";

const REPHRASE_SCENARIOS = [
  {
    name: "Direct message -> warm tone",
    raw: "You need to stop spending so much on groceries.",
    receiverSettings: { tonePreference: "warm_and_gentle", yellowTopics: ["money"] },
  },
  {
    name: "Emotional message -> direct tone",
    raw: "I feel like you never listen to me and it makes me so sad.",
    receiverSettings: { tonePreference: "direct_and_clear", yellowTopics: [] },
  },
  {
    name: "Simple positive message should not change much",
    raw: "I love you and I had a great day!",
    receiverSettings: { tonePreference: "warm_and_gentle", yellowTopics: [] },
  },
  {
    name: "Yellow topic message gets softened",
    raw: "Your mother is visiting AGAIN? We just saw her last week.",
    receiverSettings: { tonePreference: "warm_and_gentle", yellowTopics: ["family"] },
  },
  {
    name: "Message in simple English (ESL sender)",
    raw: "I want talk about the money. We spend too much this month.",
    receiverSettings: { tonePreference: "warm_and_gentle", yellowTopics: ["money"] },
  },
];

describe("AI Rephrase Quality", () => {

  for (const scenario of REPHRASE_SCENARIOS) {
    test(scenario.name, async () => {
      const result = await rephraseMessage(scenario.raw, scenario.receiverSettings);

      if (result.error) {
        console.log(`  Skipping (AI unavailable): ${result.error}`);
        return;
      }

      const judgment = await callJudge({
        original: scenario.raw,
        rephrased: result.rephrased,
        receiverTone: scenario.receiverSettings.tonePreference,
        yellowTopics: scenario.receiverSettings.yellowTopics,
      });

      console.log(`  Scenario: ${scenario.name}`);
      console.log(`  Original:  "${scenario.raw}"`);
      console.log(`  Rephrased: "${result.rephrased}"`);
      console.log(`  Scores:`, judgment.scores);

      expect(judgment.scores.meaningPreserved).toBeGreaterThanOrEqual(4);
      expect(judgment.scores.toneMatch).toBeGreaterThanOrEqual(3);
      expect(judgment.scores.noAddedContent).toBeGreaterThanOrEqual(4);
      expect(judgment.scores.naturalLanguage).toBeGreaterThanOrEqual(3);

    }, 30000);
  }
});
