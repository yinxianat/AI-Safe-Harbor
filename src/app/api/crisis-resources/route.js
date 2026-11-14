import { CRISIS_RESOURCES } from "@/lib/crisis.js";

/**
 * The list of crisis resources the UI shows alongside a crisis-flagged
 * compose result or a Health-boundary hold.
 *
 * No auth required: these are links to third-party help directories. A
 * user who hasn't signed in and triggers the detector should still be
 * able to see the card and tap through, which is the point of having
 * the detector at all.
 */
export async function GET() {
  return Response.json({ resources: CRISIS_RESOURCES });
}
