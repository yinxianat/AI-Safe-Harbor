import { REGISTRY } from "../../src/lib/ai/index.js";

// The judge is INDEPENDENT of the writer: it never imports prompt.js and never
// sees the system prompt used to produce the text it is grading. A judge shown
// the writer's instructions grades against those instructions rather than the
// outcome. It reuses the provider adapters only as transport.
//
// It also deliberately prefers a DIFFERENT provider from the one under test
// where possible, so a provider cannot mark its own homework.
function pickJudgeProvider() {
  const preferred = process.env.AI_JUDGE_PROVIDER;
  if (preferred && REGISTRY[preferred]?.isConfigured()) {
    return REGISTRY[preferred];
  }
  return Object.values(REGISTRY).find((p) => p.isConfigured()) || null;
}

export async function callJudge({ original, rephrased, receiverTone, yellowTopics }) {
  const provider = pickJudgeProvider();
  if (!provider) {
    return { scores: {}, overallPass: false, notes: "No judge provider configured" };
  }

  const prompt = `You are a quality judge for a communication app's rephrase feature.

A sender wrote this original message:
"${original}"

The app rephrased it to:
"${rephrased}"

The receiver's preferred tone is: ${receiverTone}
Topics the receiver wants handled gently: ${yellowTopics.join(", ") || "none"}

Score each dimension from 1 (terrible) to 5 (perfect):

1. meaningPreserved: Does the rephrased version keep the exact same meaning and intent? (5 = identical meaning, 1 = meaning changed or lost)
2. toneMatch: Does it match the receiver's preferred tone? (5 = perfect match, 1 = completely wrong tone)
3. noAddedContent: Does it avoid adding topics, opinions, or advice the sender didn't include? (5 = nothing added, 1 = significant additions)
4. naturalLanguage: Does it sound like a real person talking to their partner? (5 = completely natural, 1 = robotic or formal)
5. notPatronizing: Does it avoid being condescending or overly cautious? (5 = respectful and natural, 1 = talks down to the receiver)

Return ONLY valid JSON:
{
  "scores": {
    "meaningPreserved": <1-5>,
    "toneMatch": <1-5>,
    "noAddedContent": <1-5>,
    "naturalLanguage": <1-5>,
    "notPatronizing": <1-5>
  },
  "overallPass": <true if all scores >= 3 AND meaningPreserved >= 4>,
  "notes": "<one sentence about the biggest issue, if any>"
}`;

  let result;
  try {
    result = await provider.complete({
      system: "You are a strict, impartial evaluator. Return only valid JSON.",
      userMessage: prompt,
      model: provider.defaultModel(),
      maxTokens: 500,
    });
  } catch (err) {
    return { scores: {}, overallPass: false, notes: `Judge call failed: ${err?.message}` };
  }

  // Models often wrap JSON in a markdown fence.
  const cleaned = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Judge returned non-JSON:", result.text);
    return { scores: {}, overallPass: false, notes: "Judge response was not valid JSON" };
  }
}
