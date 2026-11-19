import { getSessionUser } from "@/lib/auth.js";
import { describeQuota, DAILY_TUNE_CAPS } from "@/lib/plan-limits.js";

/**
 * Peek at the signed-in user's current daily AI-tune quota.
 *
 * Returned to the iOS paywall sheet so it can render "3/5 free tunes
 * remaining today" without forcing a compose round-trip. Includes the
 * full cap table so the paywall can name the tiers inline.
 */
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({
    ...describeQuota(user),
    tiers: DAILY_TUNE_CAPS,
  });
}
