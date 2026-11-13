import { getTopicLabel } from "./topics.js";

/**
 * Plain-language explanation of why a message is sitting in the state it is.
 *
 * `status` plus `heldReason` is enough to reconstruct the decision, but only
 * if you already know the compose pipeline — and the admin board exists to
 * answer two questions that `heldReason: "ai_failed"` on its own does not:
 * is the AI doing its job, and are people getting their messages through.
 *
 * `category` is what separates those two. A `red_topic` hold is the product
 * working exactly as designed and needs no operator action; an `ai_failed`
 * hold is an outage. Counting them together produces a "held messages"
 * number that cannot be acted on.
 */

/** Non-overlapping buckets so a count can be read without interpretation. */
export const REASON_CATEGORIES = {
  AI: "ai",
  BOUNDARY: "boundary",
  USER: "user",
  OK: "ok",
  UNKNOWN: "unknown",
};

function topicList(topicTags) {
  const tags = Array.isArray(topicTags) ? topicTags : [];
  if (tags.length === 0) return null;
  return tags.map((tag) => getTopicLabel(tag) || tag).join(", ");
}

/**
 * @param message {{ status, heldReason, topicTags?, contentRephrased?, aiProvider?, senderApproved? }}
 * @returns {{ code, category, label, detail, action, actionable }}
 *   `actionable` is true only when an operator can do something about it, so
 *   a dashboard can sort the rows that need attention to the top.
 */
export function describeMessageReason(message) {
  const { status, heldReason } = message || {};
  const topics = topicList(message?.topicTags);

  if (heldReason === "red_topic") {
    return {
      code: "red_topic",
      category: REASON_CATEGORIES.BOUNDARY,
      label: "Blocked by a topic boundary",
      detail: topics
        ? `The receiver marked ${topics} off-limits for this connection, so the message was never delivered.`
        : "The receiver marked one of the detected topics off-limits for this connection.",
      action: "No operator action — this is the guardian working as designed. The sender was told, and can reword it.",
      actionable: false,
    };
  }

  if (heldReason === "content_refused") {
    return {
      code: "content_refused",
      category: REASON_CATEGORIES.AI,
      label: "The AI provider refused to rewrite it",
      detail: `${message?.aiProvider || "The provider"} returned a safety refusal rather than a rewrite. A refusal is a verdict on the text, so the chain stops instead of asking the next provider.`,
      action: "Not retryable as written. Repeated refusals on ordinary messages mean the prompt or the provider's safety settings need review.",
      actionable: true,
    };
  }

  if (heldReason === "ai_failed") {
    return {
      code: "ai_failed",
      category: REASON_CATEGORIES.AI,
      label: "Every AI provider failed",
      detail: "No provider in the chain returned a rewrite, so the message was kept as a retrievable draft rather than being sent unrewritten.",
      action: "Check the API keys, the provider status and the egress diagnostic. The sender can retry once a provider answers.",
      actionable: true,
    };
  }

  if (status === "sent") {
    return {
      code: "sent",
      category: REASON_CATEGORIES.OK,
      label: "Delivered",
      detail: "Rewritten and sent.",
      action: null,
      actionable: false,
    };
  }

  if (status === "draft") {
    // A draft with no heldReason was rewritten successfully; the only thing
    // missing is the sender's tap. Reported separately from a failure because
    // a pile-up here is an approval-step problem, not an AI problem.
    if (message?.contentRephrased) {
      return {
        code: "awaiting_sender_approval",
        category: REASON_CATEGORIES.USER,
        label: "Waiting for the sender to approve",
        detail: "The AI rewrite succeeded. The sender saw it and has not tapped send — they are still deciding, or they left the screen.",
        action: "Nothing is broken. A large or growing count here means the approval step is being abandoned and is worth looking at as a UX problem.",
        actionable: false,
      };
    }

    return {
      code: "draft_without_rewrite",
      category: REASON_CATEGORIES.UNKNOWN,
      label: "Draft with no rewrite and no recorded reason",
      detail: "The message was stored as a draft but carries neither a rewrite nor a held reason, which the compose pipeline should not produce.",
      action: "Worth investigating — this shape means a write path bypassed the compose flow or failed midway.",
      actionable: true,
    };
  }

  if (status === "held") {
    return {
      code: "held_without_reason",
      category: REASON_CATEGORIES.UNKNOWN,
      label: "Held with no recorded reason",
      detail: "The message was held but no reason was stored, so the decision cannot be reconstructed.",
      action: "Worth investigating — every hold path is supposed to write a heldReason.",
      actionable: true,
    };
  }

  return {
    code: "unknown",
    category: REASON_CATEGORIES.UNKNOWN,
    label: `Unrecognised state: ${status || "none"}${heldReason ? ` / ${heldReason}` : ""}`,
    detail: "No explanation is registered for this combination of status and held reason.",
    action: "Add it to describeMessageReason once the path that produces it is identified.",
    actionable: true,
  };
}

/** Rows grouped by reason code, most frequent first. */
export function summarizeReasons(messages) {
  const byCode = new Map();
  for (const message of messages) {
    const reason = describeMessageReason(message);
    const row = byCode.get(reason.code) || {
      reason: reason.label,
      code: reason.code,
      category: reason.category,
      count: 0,
      action: reason.action,
      needsAttention: reason.actionable,
    };
    row.count += 1;
    byCode.set(reason.code, row);
  }
  return [...byCode.values()].sort((a, b) => b.count - a.count);
}
