import prisma from "./db.js";

/**
 * Per-tier AI quota enforcement.
 *
 * Three tiers: free (5 tunes/day, Gemini only), plus (50 tunes/day, full
 * failover chain), pro (10,000 tunes/day — a sanity bound, not a real
 * cap). Numbers come from PLANS/market-research.md and are the levers
 * Apple-review-safe pricing is built around: free must be low enough
 * that heavy users feel the pinch, plus must be high enough that
 * normal couples never hit it.
 *
 * Enforcement is daily, resetting at UTC midnight. Per-user local
 * midnight would be nicer for one user and a race-condition nightmare
 * across a global DB, so UTC is the simple, predictable choice. The
 * reset is LAZY — the quota row is only touched when the user tries to
 * use AI the next day, so a user who doesn't open the app for a week
 * doesn't cost an update query.
 *
 * Also handles the "paid but subscription expired" case. Apple's webhook
 * normally downgrades a user on expiry, but if the webhook is late or
 * failed, this gate catches it at request time: a user whose
 * subscriptionExpiresAt is in the past is treated as free, regardless
 * of what the plan column says.
 */

export const DAILY_TUNE_CAPS = {
  free: 5,
  plus: 50,
  pro: 10_000,
};

// Which AI provider name the tune routes should prefer for this tier.
// "any" means use the normal failover chain (whatever AI_PROVIDER_CHAIN
// is set to). "gemini" means Gemini Flash only, which preserves free-tier
// unit economics even if a premium model joins the chain.
export const PROVIDER_FOR_PLAN = {
  free: "gemini",
  plus: "any",
  pro: "any",
};

const VALID_PLANS = new Set(Object.keys(DAILY_TUNE_CAPS));

/**
 * Normalise a user's plan to what they're ACTUALLY entitled to right now.
 *
 * `plan` can read as "plus" on the row while subscriptionExpiresAt is in
 * the past, if Apple's expiration webhook hasn't arrived yet. This gate
 * covers that by clamping expired subscriptions back to "free" every
 * time it's consulted.
 */
export function effectivePlan(user) {
  if (!user) return "free";
  const stored = typeof user.plan === "string" ? user.plan : "free";
  if (!VALID_PLANS.has(stored)) return "free";
  if (stored === "free") return "free";
  const exp = user.subscriptionExpiresAt;
  if (!exp) return stored;
  const expDate = exp instanceof Date ? exp : new Date(exp);
  if (Number.isNaN(expDate.getTime())) return "free";
  return expDate.getTime() > Date.now() ? stored : "free";
}

/**
 * The most recent UTC midnight at or before `when`. Independent helper so
 * the reset logic has one definition.
 */
export function utcMidnight(when = new Date()) {
  const d = new Date(when);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Charge one AI call against the user's daily cap.
 *
 * Returns `{ ok, used, cap, plan }`. On `ok: false` the caller must refuse
 * the AI call and surface the paywall — do NOT fall through to the free
 * model, because a paying user who hit their cap is not entitled to free
 * either and a free user is entitled to zero.
 *
 * Writes are kept small: on a same-day call we do a single `increment: 1`;
 * on first-call-after-midnight we do one write that resets the counter.
 */
export async function consumeTuneQuota(user) {
  const plan = effectivePlan(user);
  const cap = DAILY_TUNE_CAPS[plan] ?? DAILY_TUNE_CAPS.free;
  const today = utcMidnight();

  // Lazy reset: first call past UTC midnight clears the counter. A read-
  // modify-write race on this field would under-count at most one call,
  // which is the right side of the cap to err on for users; a user who
  // sees 6/5 "used" on a borderline retry is a fine outcome.
  const lastResetAt = user.tunesUsedTodayResetAt instanceof Date
    ? user.tunesUsedTodayResetAt
    : new Date(user.tunesUsedTodayResetAt || 0);
  if (lastResetAt.getTime() < today.getTime()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tunesUsedToday: 1, tunesUsedTodayResetAt: new Date() },
    });
    return { ok: true, used: 1, cap, plan };
  }

  const used = user.tunesUsedToday ?? 0;
  if (used >= cap) {
    return { ok: false, used, cap, plan };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { tunesUsedToday: { increment: 1 } },
  });
  return { ok: true, used: used + 1, cap, plan };
}

/**
 * Peek at the user's current quota without consuming it.
 *
 * Returned to the iOS client so it can render "3/5 free tunes left today"
 * on the paywall sheet without forcing a tune round-trip first.
 */
export function describeQuota(user) {
  const plan = effectivePlan(user);
  const cap = DAILY_TUNE_CAPS[plan] ?? DAILY_TUNE_CAPS.free;
  const today = utcMidnight();
  const lastResetAt = user.tunesUsedTodayResetAt instanceof Date
    ? user.tunesUsedTodayResetAt
    : new Date(user.tunesUsedTodayResetAt || 0);
  const used = lastResetAt.getTime() < today.getTime() ? 0 : (user.tunesUsedToday ?? 0);
  return { plan, cap, used, remaining: Math.max(0, cap - used) };
}
