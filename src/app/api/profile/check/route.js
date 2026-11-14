import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { loadContactsWithBoundaries } from "@/lib/profile-contacts.js";
import { reviewForAudience } from "@/lib/profile-audience.js";
import { getTopicLabel, getTopicLabelKey } from "@/lib/topics.js";

/**
 * Judge a draft note against every contact in its intended audience.
 *
 * Keyword matching only — no AI call — so the editor can run this as the
 * author types without cost or latency. The semantic AI pass belongs to the
 * tune step, which the author triggers deliberately.
 */
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const text = typeof body.data.text === "string" ? body.data.text : "";
  const visibleTo = Array.isArray(body.data.visibleTo) ? body.data.visibleTo : [];

  const contacts = await loadContactsWithBoundaries(user.id);
  const review = reviewForAudience(text, contacts, visibleTo);

  const withLabels = (topics) => topics.map((key) => ({ key, label: getTopicLabel(key), labelKey: getTopicLabelKey(key) }));

  return Response.json({
    blockedEntirely: review.blockedEntirely,
    excludedFrom: review.excludedFrom,
    deliverableTo: review.deliverableTo,
    blocked: review.blocked.map((c) => ({ ...c, topics: withLabels(c.redTopics) })),
    softened: review.softened.map((c) => ({ ...c, topics: withLabels(c.yellowTopics) })),
    perContact: review.perContact.map((c) => ({
      connectionId: c.connectionId,
      name: c.name,
      status: c.status,
      redTopics: withLabels(c.redTopics),
      yellowTopics: withLabels(c.yellowTopics),
      unenforceable: withLabels(c.unenforceable),
    })),
  });
}
