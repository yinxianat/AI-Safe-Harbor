import { getSessionUser } from "@/lib/auth.js";
import { isAdminEmail } from "@/lib/admin-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const VALID_THEMES = ["light", "dark", "sunrise", "serene"];
// Cap for inline avatar data URLs. 400 KB base64 ≈ 300 KB binary, plenty
// for a 400x400 face; anything more probably means the client didn't resize.
const MAX_AVATAR_LENGTH = 400_000;

function serialize(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username || null,
    displayName: u.displayName,
    timezone: u.timezone,
    sessionDays: u.sessionDays || 30,
    locale: u.locale || "en",
    theme: u.theme || "light",
    avatarUrl: u.avatarUrl || null,
    isAdmin: isAdminEmail(u.email),
  };
}

export async function GET(request) {
  const user = await getSessionUser(request);

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json(serialize(user));
}

export async function PATCH(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const updates = {};

  if (body.data.displayName !== undefined) {
    const name = requireString(body.data.displayName, { maxLength: 50 });
    updates.displayName = name || null;
  }

  if (body.data.timezone !== undefined) {
    const tz = requireString(body.data.timezone, { maxLength: 50 });
    if (tz) updates.timezone = tz;
  }

  if (body.data.sessionDays !== undefined) {
    const days = Number(body.data.sessionDays);
    if ([7, 14, 30, 90].includes(days)) updates.sessionDays = days;
  }

  if (body.data.locale !== undefined) {
    const loc = String(body.data.locale);
    if (["en", "zh-CN"].includes(loc)) updates.locale = loc;
  }

  if (body.data.theme !== undefined) {
    const t = String(body.data.theme);
    if (VALID_THEMES.includes(t)) updates.theme = t;
  }

  if (body.data.avatarUrl !== undefined) {
    const raw = body.data.avatarUrl;
    if (raw === null || raw === "") {
      updates.avatarUrl = null;
    } else if (typeof raw === "string") {
      // Only inline data URLs for images — rules out `javascript:` and
      // external URLs an attacker could point at tracking infrastructure.
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(raw)) {
        return badRequest("invalid_avatar");
      }
      if (raw.length > MAX_AVATAR_LENGTH) {
        return Response.json(
          { error: "avatar_too_large", detail: "Avatar must be under 300 KB. Resize and try again." },
          { status: 400 }
        );
      }
      updates.avatarUrl = raw;
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("nothing_to_update");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
  });

  return Response.json(serialize(updated));
}
