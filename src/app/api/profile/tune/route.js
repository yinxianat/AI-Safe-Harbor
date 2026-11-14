import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { checkRateLimit } from "@/lib/rate-limit.js";
import { loadContactsWithBoundaries } from "@/lib/profile-contacts.js";
import { reviewForAudience } from "@/lib/profile-audience.js";
import { rephraseMessage } from "@/lib/ai/index.js";
import { getTopicLabel, getTopicLabelKey } from "@/lib/topics.js";

const MAX_TEXT = 2000;
// One AI call per recipient, so a wide audience is also an expensive request.
const MAX_RECIPIENTS = 8;

/**
 * Produce one rewrite of a note per recipient, each matched to that person's
 * tone preference, relationship and gentle topics.
 *
 * Nothing is stored here. The author reviews the variants and chooses which
 * to keep, which is what keeps the app's "nothing published unreviewed"
 * promise intact for AI-written profile text.
 */
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const text = typeof body.data.text === "string" ? body.data.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) return badRequest("text_required");

  const visibleTo = Array.isArray(body.data.visibleTo) ? body.data.visibleTo : [];

  const limit = checkRateLimit(`profile-tune:${user.id}`, {
    maxRequests: 20,
    windowMs: 10 * 60_000,
  });
  if (!limit.allowed) {
    return Response.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const contacts = await loadContactsWithBoundaries(user.id);
  const review = reviewForAudience(text, contacts, visibleTo);

  // Tuning for someone the note will be withheld from would burn a call on
  // text they never see, so only deliverable recipients get a variant.
  const targets = contacts
    .filter((c) => review.deliverableTo.includes(c.connectionId))
    .slice(0, MAX_RECIPIENTS);

  if (targets.length === 0) {
    return Response.json({
      variants: [],
      blockedEntirely: review.blockedEntirely,
      blocked: review.blocked.map((c) => ({
        ...c,
        topics: c.redTopics.map((key) => ({ key, label: getTopicLabel(key), labelKey: getTopicLabelKey(key) })),
      })),
    });
  }

  const results = await Promise.all(
    targets.map(async (contact) => {
      const yellowTopics = (contact.topicSettings || [])
        .filter((s) => s.comfortLevel === "yellow")
        .map((s) => s.sanitizedLabel || getTopicLabel(s.topicName));

      const topicNotes = (contact.topicSettings || [])
        .filter((s) => s.note && s.comfortLevel !== "green")
        .map((s) => ({ topic: s.sanitizedLabel || getTopicLabel(s.topicName), note: s.note }));

      const result = await rephraseMessage(text, {
        tonePreference: contact.tonePreference,
        tonePrompt: contact.tonePrompt,
        relationshipType: contact.relationshipType,
        yellowTopics,
        topicNotes,
        locale: user.locale || "en",
      }).catch(() => ({ rephrased: null, error: "ai_unavailable" }));

      // The rationale is assembled from the exact inputs handed to the model,
      // not asked of the model itself: it costs nothing, cannot drift from
      // what actually shaped the rewrite, and stays translatable because the
      // client renders each reason from a key rather than a prose sentence.
      const reasons = [{ kind: "tone", tone: contact.tonePreference }];
      if (contact.relationshipType && contact.relationshipType !== "other") {
        reasons.push({ kind: "relationship", relationshipType: contact.relationshipType });
      }
      if (yellowTopics.length > 0) {
        reasons.push({ kind: "softened", topics: yellowTopics });
      }
      for (const n of topicNotes.slice(0, 3)) {
        reasons.push({ kind: "topic_note", topic: n.topic, note: n.note });
      }
      if (contact.tonePrompt) {
        reasons.push({ kind: "custom", instruction: contact.tonePrompt });
      }

      return {
        connectionId: contact.connectionId,
        name: contact.name,
        tonePreference: contact.tonePreference,
        relationshipType: contact.relationshipType,
        tuned: result.rephrased || null,
        error: result.rephrased ? null : result.error || "ai_unavailable",
        softenedTopics: yellowTopics,
        reasons,
      };
    })
  );

  return Response.json({
    variants: results,
    blockedEntirely: review.blockedEntirely,
    blocked: review.blocked.map((c) => ({
      ...c,
      topics: c.redTopics.map((key) => ({ key, label: getTopicLabel(key), labelKey: getTopicLabelKey(key) })),
    })),
  });
}
