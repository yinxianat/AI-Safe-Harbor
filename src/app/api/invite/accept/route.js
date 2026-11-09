import { verifyMagicToken, consumeMagicToken, createSession } from "@/lib/auth.js";
import { getBaseUrl } from "@/lib/base-url.js";
import prisma from "@/lib/db.js";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const baseUrl = getBaseUrl(request);

  const fail = (reason) =>
    NextResponse.redirect(new URL(`/?error=${reason}`, baseUrl));

  if (!token) {
    return fail("missing_token");
  }

  // Verified WITHOUT consuming: a failure past this point must leave the link
  // usable, otherwise one unlucky attempt permanently burns the invitation.
  const result = await verifyMagicToken(token, "invite", { consume: false });

  if (!result.valid) {
    return fail(result.reason);
  }

  const inviter = result.invitedByUserId
    ? await prisma.user.findUnique({ where: { id: result.invitedByUserId } })
    : null;

  if (!inviter) {
    return fail("inviter_not_found");
  }

  // Claim the token only once the invitation is known to be actionable. The
  // invitee record is created after this, so a failed attempt leaves no
  // orphaned user behind either.
  if (!(await consumeMagicToken(result.tokenId))) {
    return fail("consumed");
  }

  const invitee = await prisma.user.upsert({
    where: { email: result.email },
    update: {},
    create: { email: result.email },
  });

  if (invitee.id === inviter.id) {
    return fail("cannot_invite_self");
  }

  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { userAId: inviter.id, userBId: invitee.id },
        { userAId: invitee.id, userBId: inviter.id },
      ],
    },
  });

  if (!existing) {
    await prisma.connection.create({
      data: { userAId: inviter.id, userBId: invitee.id, status: "active" },
    });
  } else if (existing.status !== "active") {
    await prisma.connection.update({
      where: { id: existing.id },
      data: { status: "active" },
    });
  }

  const sessionToken = await createSession(invitee.id);
  const response = NextResponse.redirect(new URL("/dashboard", baseUrl));

  response.cookies.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
