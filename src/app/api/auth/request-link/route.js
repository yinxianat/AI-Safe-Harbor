import { generateMagicToken } from "@/lib/auth.js";
import { getBaseUrl } from "@/lib/base-url.js";
import { parseJsonBody, requireString } from "@/lib/http.js";
import { sendMail } from "@/lib/mailer.js";
import { logError } from "@/lib/logger.js";

export async function POST(request) {
  const body = await parseJsonBody(request);

  // Always 200, whatever happens — the response must not reveal whether an
  // address is registered, malformed, or failed to send.
  const ok = () => Response.json({ sent: true });

  if (!body.ok) {
    return ok();
  }

  const email = requireString(body.data.email, { maxLength: 320 })?.toLowerCase();
  if (!email || !email.includes("@")) {
    return ok();
  }

  let magicLink;
  try {
    const { plaintext } = await generateMagicToken(email, "login");
    magicLink = `${getBaseUrl(request)}/api/auth/verify?token=${plaintext}`;
  } catch (err) {
    logError("api.auth.request-link", "could not issue magic link", err?.message);
    return ok();
  }

  // Delivery is deliberately NOT awaited. A mail server that is slow, wrong, or
  // refusing credentials would otherwise hold the HTTP response open for as
  // long as it takes to fail — which the user experiences as a page spinning
  // forever, unable to tell "still sending" from "silently broken".
  //
  // The token is already stored, so the link is valid whether or not this send
  // succeeds, and a failure is recorded where an operator can actually see it.
  sendMail({
    to: email,
    subject: "Leeway — Sign In Link",
    text: `Click to sign in: ${magicLink}\n\nThis link expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Click to sign in:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p><p style="color:#64748b;font-size:13px">If you did not request this, you can ignore this email.</p>`,
  })
    .then((delivery) => {
      if (delivery.error) {
        logError(
          "api.auth.request-link",
          "sign-in email could not be delivered",
          delivery.detail || delivery.error
        );
      }
    })
    .catch((err) => {
      logError("api.auth.request-link", "sign-in email threw unexpectedly", err?.message);
    });

  return ok();
}
