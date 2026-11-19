import { issueTokens, verifyRefreshToken } from "@/lib/mobile-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";

/**
 * Refresh an iOS access token.
 *
 * The client sends `{ refreshToken }`. If it verifies and the user still
 * exists, we mint a new access+refresh pair and return them. We rotate
 * the refresh token too — a classic rotation pattern — so a captured
 * refresh token has a shorter real-world lifetime than its 90-day expiry
 * suggests.
 */
export async function POST(request) {
  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const refresh = requireString(body.data.refreshToken, { maxLength: 4000 });
  if (!refresh) return badRequest("missing_refresh_token");

  const user = await verifyRefreshToken(refresh);
  if (!user) return Response.json({ error: "invalid_refresh_token" }, { status: 401 });

  const tokens = await issueTokens(user);
  return Response.json(tokens);
}
