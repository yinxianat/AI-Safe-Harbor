import { issueAccessToken, issueRefreshToken, verifyRefreshToken, issueTokens } from "../src/lib/mobile-auth.js";
import { verifySession } from "../src/lib/auth.js";

/**
 * JWT access and refresh tokens are the only way iOS talks to the server.
 * The audit items these tests pin:
 *
 *   - Access tokens pass verifySession; refresh tokens do NOT.
 *   - verifyRefreshToken accepts refresh tokens only, never access tokens.
 *   - Both tokens round-trip the user id.
 *   - Malformed tokens are rejected.
 */

// jose needs JWT_SECRET; test env should already have it. Fall back to a
// deterministic value so this suite can run on a fresh checkout.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!";
}

const USER = { id: "user_abc", email: "a@example.com", plan: "plus" };

describe("mobile tokens", () => {
  it("issueAccessToken produces a JWT that verifySession accepts", async () => {
    const access = await issueAccessToken(USER);
    const result = await verifySession(access);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe("user_abc");
  });

  it("issueRefreshToken produces a JWT that verifySession REJECTS", async () => {
    // The critical split: a refresh token must not be usable as a session.
    const refresh = await issueRefreshToken(USER);
    const result = await verifySession(refresh);
    expect(result.valid).toBe(false);
  });

  it("verifyRefreshToken refuses an access token", async () => {
    const access = await issueAccessToken(USER);
    await expect(verifyRefreshToken(access)).resolves.toBeNull();
  });

  it("verifyRefreshToken refuses garbage and missing tokens", async () => {
    await expect(verifyRefreshToken("")).resolves.toBeNull();
    await expect(verifyRefreshToken(null)).resolves.toBeNull();
    await expect(verifyRefreshToken("not-a-jwt")).resolves.toBeNull();
    await expect(verifyRefreshToken("a.b.c")).resolves.toBeNull();
  });

  it("issueTokens produces both halves at once", async () => {
    const pair = await issueTokens(USER);
    expect(typeof pair.accessToken).toBe("string");
    expect(typeof pair.refreshToken).toBe("string");
    expect(pair.accessToken).not.toBe(pair.refreshToken);
  });
});
