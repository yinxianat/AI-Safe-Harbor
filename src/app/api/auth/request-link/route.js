import { generateMagicToken } from "@/lib/auth.js";
import { getBaseUrl } from "@/lib/base-url.js";
import { parseJsonBody, requireString } from "@/lib/http.js";
import { sendMail } from "@/lib/mailer.js";

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

  try {
    const { plaintext } = await generateMagicToken(email, "login");
    const magicLink = `${getBaseUrl(request)}/api/auth/verify?token=${plaintext}`;

    await sendMail({
      to: email,
      subject: "SafeHarbor — Sign In Link",
      text: `Click to sign in: ${magicLink}\n\nThis link expires in 15 minutes.`,
      html: `<p>Click to sign in: <a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p>`,
    });
  } catch (err) {
    console.error("Magic link error:", err.message);
  }

  return ok();
}
