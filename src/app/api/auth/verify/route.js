import { verifyMagicToken, createSession } from "@/lib/auth.js";
import { getBaseUrl } from "@/lib/base-url.js";
import prisma from "@/lib/db.js";
import { NextResponse } from "next/server";

async function establishSession(token, baseUrl) {
  // Purpose pinned to "login": without it an invite token could be redeemed
  // here, granting a session while skipping connection creation entirely.
  const result = await verifyMagicToken(token, "login");

  if (!result.valid) {
    return { ok: false, reason: result.reason };
  }

  const user = await prisma.user.upsert({
    where: { email: result.email },
    update: {},
    create: { email: result.email },
  });

  return { ok: true, user, session: await createSession(user.id) };
}

function withSessionCookie(response, sessionToken) {
  response.cookies.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const baseUrl = getBaseUrl(request);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=missing_token", baseUrl));
  }

  const result = await establishSession(token, baseUrl);
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/?error=${result.reason}`, baseUrl));
  }

  return withSessionCookie(
    NextResponse.redirect(new URL("/circle", baseUrl)),
    result.session
  );
}
