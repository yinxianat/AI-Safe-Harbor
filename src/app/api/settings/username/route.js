import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { validateUsername } from "@/lib/username.js";
import prisma from "@/lib/db.js";

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ username: user.username || null });
}

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const result = validateUsername(body.data.username);
  if (!result.ok) {
    return Response.json({ error: "invalid_username", detail: result.error }, { status: 400 });
  }

  if (result.username === user.username) {
    return Response.json({ username: user.username });
  }

  const taken = await prisma.user.findUnique({ where: { username: result.username } });
  if (taken) {
    return Response.json(
      { error: "username_taken", detail: "That username is taken — try another." },
      { status: 409 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { username: result.username },
  });

  return Response.json({ username: updated.username });
}
