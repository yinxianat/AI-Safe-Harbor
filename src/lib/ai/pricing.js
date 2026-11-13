/**
 * Cost estimation for AI usage.
 *
 * These rates are a configured default, NOT a billing source of truth. List
 * prices change, and they vary by tier, region and commitment, so a figure
 * hardcoded in source goes stale silently and quietly reports the wrong
 * number. Two guards against that:
 *
 *   1. RATES_VERIFIED_ON is stamped below. The API returns it so the admin
 *      page can show how old the rates are.
 *   2. AI_PRICE_OVERRIDES can replace any entry at runtime without a deploy,
 *      as JSON: {"claude-sonnet-4-5":{"inputPerMTok":3,"outputPerMTok":15}}
 *
 * A further limitation worth knowing when reading the numbers: Message only
 * stores `aiTokensUsed` as a single total, with no input/output split. Since
 * output tokens cost several times more than input, this module applies a
 * blended rate and the result is an estimate with real error bars — see
 * estimateCost(). Splitting the stored counts is the fix, and until then
 * these figures should be treated as an order-of-magnitude guide.
 */

export const RATES_VERIFIED_ON = "2026-11-13";

// USD per million tokens, as published list prices on RATES_VERIFIED_ON.
const DEFAULT_RATES = {
  "claude-opus-4-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-4-5": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  "gemini-2.5-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  "gemini-2.5-pro": { inputPerMTok: 1.25, outputPerMTok: 10 },
};

// Used when a row's model isn't in the table at all, so an unrecognized model
// still contributes a non-zero estimate rather than silently costing nothing.
const FALLBACK_RATE = { inputPerMTok: 3, outputPerMTok: 15 };

// Rephrasing sends a system prompt plus the draft and gets back something
// about as long as the draft, so most tokens on this workload are input.
// Shifting this assumption moves the estimate, which is why it's named.
const ASSUMED_OUTPUT_SHARE = 0.3;

function overrides() {
  const raw = process.env.AI_PRICE_OVERRIDES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Bad JSON must not take down the admin page; fall back to defaults.
    return {};
  }
}

export function rateFor(model) {
  if (!model) return { ...FALLBACK_RATE, known: false };
  const custom = overrides()[model];
  if (custom && typeof custom.inputPerMTok === "number" && typeof custom.outputPerMTok === "number") {
    return { inputPerMTok: custom.inputPerMTok, outputPerMTok: custom.outputPerMTok, known: true };
  }
  const known = DEFAULT_RATES[model];
  if (known) return { ...known, known: true };

  // Match a versioned id (claude-sonnet-4-5-20260101) against its family.
  const prefix = Object.keys(DEFAULT_RATES).find((k) => model.startsWith(k));
  if (prefix) return { ...DEFAULT_RATES[prefix], known: true };

  return { ...FALLBACK_RATE, known: false };
}

/**
 * Estimated USD for `totalTokens` on `model`, using a blended rate because
 * the stored total has no input/output split.
 */
export function estimateCost(model, totalTokens) {
  const tokens = Number(totalTokens) || 0;
  if (tokens <= 0) return { usd: 0, known: rateFor(model).known };
  const rate = rateFor(model);
  const blendedPerMTok =
    rate.inputPerMTok * (1 - ASSUMED_OUTPUT_SHARE) + rate.outputPerMTok * ASSUMED_OUTPUT_SHARE;
  return {
    usd: (tokens / 1_000_000) * blendedPerMTok,
    known: rate.known,
  };
}

/**
 * Roll a set of AI calls up into totals, per-model breakdown, and per-user
 * averages.
 *
 * @param calls [{ model, tokens, userId }]
 * @returns totals plus `unknownModels` so the admin page can say which
 *          models were costed with the fallback rate.
 */
export function summarizeUsage(calls) {
  const byModel = {};
  const users = new Set();
  let totalTokens = 0;
  let totalUsd = 0;
  const unknownModels = new Set();

  for (const call of calls || []) {
    const tokens = Number(call.tokens) || 0;
    // A call with no recorded model or zero tokens is a failed or held
    // request; it still counts as activity but carries no cost.
    const model = call.model || "unrecorded";
    if (call.userId) users.add(call.userId);

    const { usd, known } = estimateCost(call.model, tokens);
    if (tokens > 0 && !known) unknownModels.add(model);

    totalTokens += tokens;
    totalUsd += usd;

    byModel[model] ||= { model, calls: 0, tokens: 0, usd: 0, rateKnown: known };
    byModel[model].calls += 1;
    byModel[model].tokens += tokens;
    byModel[model].usd += usd;
  }

  const userCount = users.size;

  return {
    totalCalls: (calls || []).length,
    totalTokens,
    totalUsd,
    userCount,
    usdPerUser: userCount > 0 ? totalUsd / userCount : 0,
    tokensPerUser: userCount > 0 ? totalTokens / userCount : 0,
    tokensPerCall: (calls || []).length > 0 ? totalTokens / calls.length : 0,
    byModel: Object.values(byModel).sort((a, b) => b.usd - a.usd),
    unknownModels: [...unknownModels],
    ratesVerifiedOn: RATES_VERIFIED_ON,
    assumedOutputShare: ASSUMED_OUTPUT_SHARE,
  };
}

/** Linear projection from a window's spend to a 30-day figure. */
export function projectMonthly(usd, windowDays) {
  const days = Number(windowDays) || 0;
  if (days <= 0) return 0;
  return (usd / days) * 30;
}
