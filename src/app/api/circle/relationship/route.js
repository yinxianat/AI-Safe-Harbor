import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const VALID_RELATIONSHIPS = [
  "spouse",
  "partner",
  "friend",
  "sibling",
  "parent",
  "child",
  "coworker",
  "roommate",
  "other",
];

export async function PUT(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return badRequest("invalid_json");
  }

  const connectionId = requireString(body.data.connectionId, { maxLength: 64 });
  const relationshipType = requireString(body.data.relationshipType, { maxLength: 24 });

  if (!connectionId) return badRequest("missing_connectionId");
  if (!VALID_RELATIONSHIPS.includes(relationshipType)) return badRequest("invalid_relationship");

  const updated = await prisma.connection.updateMany({
    where: {
      id: connectionId,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    data: { relationshipType },
  });

  if (updated.count === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ relationshipType });
}

export function GET() {
  return Response.json({ validRelationships: VALID_RELATIONSHIPS });
}
