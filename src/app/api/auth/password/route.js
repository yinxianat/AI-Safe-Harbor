import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { hashPassword, validatePasswordShape, verifyPassword } from "@/lib/password.js";
import prisma from "@/lib/db.js";

/**
 * Set or change the signed-in user's password.
 * - First-time set (no existing passwordHash): only newPassword required.
 * - Change: currentPassword must verify before newPassword takes effect.
 */
export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const currentPassword = typeof body.data.currentPassword === "string" ? body.data.currentPassword : "";
  const newPassword = typeof body.data.newPassword === "string" ? body.data.newPassword : "";

  const shape = validatePasswordShape(newPassword);
  if (!shape.ok) {
    return Response.json({ error: shape.reason, detail: shape.detail }, { status: 400 });
  }

  // Changing an existing password requires the old one. Not required for
  // first-time set because a magic-link user has no prior password to prove.
  if (user.passwordHash) {
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      return Response.json({ error: "invalid_current_password" }, { status: 401 });
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return Response.json({ ok: true });
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ hasPassword: Boolean(user.passwordHash) });
}

// A signed-in user who forgot their password can clear it here. The threat
// model is: they still have session access (typically fresh from a magic
// link), so letting them wipe the hash is no worse than letting them change
// email or delete the account from the same screen.
export async function DELETE(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: null },
  });
  return Response.json({ ok: true });
}
