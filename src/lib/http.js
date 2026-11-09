// A malformed or empty request body is a client error, not a server crash.
// Every POST/PUT route parses through this instead of bare `request.json()`.
export async function parseJsonBody(request) {
  try {
    const data = await request.json();
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false };
    }
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export function badRequest(error) {
  return Response.json({ error }, { status: 400 });
}

export function requireString(value, { maxLength }) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}
