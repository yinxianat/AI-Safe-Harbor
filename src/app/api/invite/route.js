import { getSessionUser, generateMagicToken } from "@/lib/auth.js";
import { getBaseUrl } from "@/lib/base-url.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { sendMail } from "@/lib/mailer.js";
import { logError } from "@/lib/logger.js";
import prisma from "@/lib/db.js";

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const email = requireString(body.data.email, { maxLength: 320 })?.toLowerCase();
  if (!email || !email.includes("@")) {
    return badRequest("invalid_email");
  }

  if (email === user.email.toLowerCase()) {
    return badRequest("cannot_invite_self");
  }

  const existingConnection = await prisma.connection.findFirst({
    where: {
      OR: [
        { userAId: user.id, userB: { email } },
        { userBId: user.id, userA: { email } },
      ],
    },
  });

  if (existingConnection) {
    return Response.json({ error: "connection_exists" }, { status: 409 });
  }

  const { plaintext } = await generateMagicToken(email, "invite", {
    invitedByUserId: user.id,
  });

  const inviteLink = `${getBaseUrl(request)}/api/invite/accept?token=${plaintext}`;
  const inviterName = user.displayName || "Someone";

  // Not awaited, for the same reason as the sign-in route: a failing mail
  // server must not hold the response open. The invitation is already valid.
  sendMail({
    to: email,
    subject: `${inviterName} invited you to Leeway`,
    text: `You've been invited to connect on Leeway.\n\nAccept: ${inviteLink}\n\nThis link expires in 15 minutes.`,
    html: `<p>${inviterName} invited you to connect on Leeway.</p><p><a href="${inviteLink}">Accept Invitation</a></p><p>This link expires in 15 minutes.</p>`,
  })
    .then((delivery) => {
      if (delivery.error) {
        logError(
          "api.invite",
          "invitation email could not be delivered",
          delivery.detail || delivery.error
        );
      }
    })
    .catch((err) => {
      logError("api.invite", "invitation email threw unexpectedly", err?.message);
    });

  return Response.json({ sent: true });
}
