import { getSessionUser, generateMagicToken } from "@/lib/auth.js";
import { getBaseUrl } from "@/lib/base-url.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { sendMail, deliveryHealth } from "@/lib/mailer.js";
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

  let inviteLink;
  try {
    inviteLink = `${getBaseUrl(request)}/api/invite/accept?token=${plaintext}`;
  } catch (err) {
    // BASE_URL is misconfigured — an unresolved Railway template, or
    // unset in production. The token already exists in the DB, but a
    // link we can't build is a link we can't mail, so surface it.
    logError("api.invite", "could not build invite link", err?.message);
    return Response.json(
      { sent: false, deliveryDegraded: true, reason: "base_url_misconfigured" },
      { status: 500 }
    );
  }
  const inviterName = user.displayName || "Someone";

  // Wait briefly for the send to confirm. Most failure modes — bad
  // credentials, unreachable host, sender rejected — reply within the
  // timeout, and surfacing them turns "the user clicked and nothing
  // arrived" into a real error. A slow server that hasn't finished by
  // the timeout falls through to the fire-and-forget path below, so a
  // slow mailer doesn't hang the UI.
  const SEND_CONFIRM_TIMEOUT_MS = 4000;

  const sendPromise = sendMail({
    to: email,
    subject: `${inviterName} invited you to Leeway`,
    text: `You've been invited to connect on Leeway.\n\nAccept: ${inviteLink}\n\nThis link expires in 15 minutes.`,
    html: `<p>${inviterName} invited you to connect on Leeway.</p><p><a href="${inviteLink}">Accept Invitation</a></p><p>This link expires in 15 minutes.</p>`,
  });

  // A `null` resolution means the timeout won — the send is still running.
  const quick = await Promise.race([
    sendPromise.catch((err) => ({ delivered: false, error: "exception", detail: err?.message })),
    new Promise((resolve) => setTimeout(() => resolve(null), SEND_CONFIRM_TIMEOUT_MS)),
  ]);

  if (quick && quick.error) {
    // Fast failure: SMTP replied "no" within the timeout. Report it
    // honestly, with the classified reason the mailer already builds.
    logError("api.invite", "invitation email failed fast", quick.detail || quick.error);
    return Response.json({
      sent: false,
      deliveryDegraded: true,
      reason: quick.error,
    });
  }

  if (quick === null) {
    // Still running; let it finish in the background and log any
    // outcome. The response here goes back as "probably sent"; if it
    // later fails, deliveryHealth will say so on the NEXT invite and
    // the UI will show the amber "we couldn't send that email yet"
    // card then.
    sendPromise
      .then((delivery) => {
        if (delivery?.error) {
          logError("api.invite", "invitation email could not be delivered",
            delivery.detail || delivery.error);
        }
      })
      .catch((err) => {
        logError("api.invite", "invitation email threw unexpectedly", err?.message);
      });
  }

  const health = deliveryHealth();
  return Response.json({
    sent: true,
    deliveryDegraded: health.degraded,
    reason: health.reason || null,
  });
}
