import { getSessionUser } from "@/lib/auth.js";

export async function GET(request) {
  const user = await getSessionUser(request);

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
  });
}
