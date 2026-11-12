import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import prisma from "./db.js";
import { getJwtSecret, getMagicLinkSecret } from "./env.js";

const TOKEN_EXPIRY_SECONDS = 15 * 60;

function jwtKey() {
  return new TextEncoder().encode(getJwtSecret());
}

function hashToken(plaintext, purpose) {
  return createHash("sha256")
    .update(plaintext + getMagicLinkSecret() + purpose)
    .digest("hex");
}

export async function generateMagicToken(
  email,
  purpose,
  { expiryOffsetSeconds, invitedByUserId = null } = {}
) {
  const plaintext = randomBytes(32).toString("hex");
  const tokenHash = hashToken(plaintext, purpose);

  const expiresAt = new Date(
    Date.now() +
      (expiryOffsetSeconds !== undefined
        ? expiryOffsetSeconds * 1000
        : TOKEN_EXPIRY_SECONDS * 1000)
  );

  // `userId` is the account this token signs IN, resolved from the recipient
  // address. The person who sent an invite is tracked separately in
  // `invitedByUserId` — conflating the two previously made every invite either
  // fail or create a self-connection.
  const recipient = await prisma.user.findUnique({ where: { email } });

  await prisma.magicToken.create({
    data: {
      tokenHash,
      email,
      purpose,
      userId: recipient?.id ?? null,
      invitedByUserId,
      expiresAt,
    },
  });

  return { plaintext, hash: tokenHash };
}

export async function verifyMagicToken(plaintext, expectedPurpose, { consume = true } = {}) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    return { valid: false, reason: "missing_token" };
  }

  const purposes = expectedPurpose ? [expectedPurpose] : ["login", "invite"];
  let record = null;

  for (const purpose of purposes) {
    const found = await prisma.magicToken.findUnique({
      where: { tokenHash: hashToken(plaintext, purpose) },
    });
    if (found) {
      if (expectedPurpose && found.purpose !== expectedPurpose) {
        return { valid: false, reason: "wrong_purpose" };
      }
      record = found;
      break;
    }
  }

  if (!record) {
    return { valid: false, reason: "invalid_token" };
  }

  if (record.consumed) {
    return { valid: false, reason: "consumed" };
  }

  if (record.expiresAt < new Date()) {
    return { valid: false, reason: "expired" };
  }

  if (consume) {
    const claimed = await consumeMagicToken(record.id);
    if (!claimed) {
      return { valid: false, reason: "consumed" };
    }
  }

  return {
    valid: true,
    tokenId: record.id,
    email: record.email,
    purpose: record.purpose,
    userId: record.userId,
    invitedByUserId: record.invitedByUserId,
  };
}

// Conditional update, so two concurrent redemptions cannot both succeed.
export async function consumeMagicToken(tokenId) {
  const claimed = await prisma.magicToken.updateMany({
    where: { id: tokenId, consumed: false },
    data: { consumed: true },
  });
  return claimed.count === 1;
}

export async function createSession(userId, sessionDays = 30) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionDays}d`)
    .sign(jwtKey());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, jwtKey());
    return { valid: true, userId: payload.userId };
  } catch {
    return { valid: false };
  }
}

function readSessionCookie(request) {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("session=")) {
      return trimmed.slice("session=".length);
    }
  }
  return null;
}

export async function getSessionUser(request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || readSessionCookie(request);

  if (!token) {
    return null;
  }

  const result = await verifySession(token);
  if (!result.valid) {
    return null;
  }

  return prisma.user.findUnique({ where: { id: result.userId } });
}
