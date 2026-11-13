import { requireAdmin } from "@/lib/admin-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { describeMessageReason, summarizeReasons } from "@/lib/message-reasons.js";
import prisma from "@/lib/db.js";

/**
 * Read-only query catalog for the admin board.
 *
 * Each entry carries a `source`: the query as it is actually written, shown
 * to the operator alongside the rows. A table of results with no statement
 * next to it cannot be reasoned about — "recent messages" does not say
 * whether that means 24 hours or 7 days, or how many rows were dropped by the
 * limit, and the answer changes what the numbers mean.
 */

const SINCE_24H = "new Date(Date.now() - 24 * 60 * 60 * 1000)";

/** The explanation columns are placed first so they read before the ids. */
function withReason(message) {
  const reason = describeMessageReason(message);
  return {
    reason: reason.label,
    why: reason.detail,
    whatToDo: reason.action,
    category: reason.category,
    needsAttention: reason.actionable,
    ...message,
  };
}

const QUERIES = {
  recent_messages: {
    title: "Recent messages",
    question: "What messages were sent in the last 24 hours?",
    source: `prisma.message.findMany({
  where: { createdAt: { gte: ${SINCE_24H} } },
  select: {
    id, status, heldReason, contentRephrased, aiProvider, aiModel,
    aiTokensUsed, topicTags, createdAt,
    sender: { displayName, username, email },
  },
  orderBy: { createdAt: "desc" },
  take: 100,
})

// Each row is then annotated by describeMessageReason() in
// src/lib/message-reasons.js — reason / why / whatToDo are derived,
// not stored columns.`,
    run: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await prisma.message.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true, status: true, heldReason: true, aiProvider: true, aiModel: true,
          aiTokensUsed: true, topicTags: true, createdAt: true,
          // Needed to tell a draft that is waiting for its author from one
          // that never got a rewrite at all.
          contentRephrased: true,
          sender: { select: { displayName: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      // The body itself is private; only its presence decides the reason.
      return rows.map((row) => withReason({ ...row, contentRephrased: Boolean(row.contentRephrased) }));
    },
  },
  held_messages: {
    title: "Held messages",
    question: "What messages have been held, and why?",
    source: `prisma.message.findMany({
  where: { status: "held" },
  select: {
    id, status, heldReason, topicTags, aiProvider,
    contentRephrased, createdAt,
    sender: { displayName, username, email },
  },
  orderBy: { createdAt: "desc" },
  take: 50,
})

// The body is NOT selected. A held message is the most private content in
// the app — it is precisely what a receiver declared off-limits, and the
// Health boundary makes medical and crisis text the likeliest thing to land
// here. topicTags and the derived reason say why it was held without
// reproducing what was said.

// reason / why / whatToDo come from describeMessageReason().
// category is one of: boundary (the guardian working as designed),
// ai (a provider problem), user, unknown.`,
    run: async () => {
      const rows = await prisma.message.findMany({
        where: { status: "held" },
        select: {
          id: true, status: true, heldReason: true,
          topicTags: true, aiProvider: true, contentRephrased: true,
          createdAt: true,
          sender: { select: { displayName: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return rows.map((row) => withReason({ ...row, contentRephrased: Boolean(row.contentRephrased) }));
    },
  },
  draft_messages: {
    title: "Unsent drafts",
    question: "What messages are stuck as drafts, and why?",
    source: `prisma.message.findMany({
  where: { status: "draft" },
  select: {
    id, status, heldReason, topicTags, aiProvider, aiModel,
    contentRephrased, createdAt,
    sender: { displayName, username, email },
  },
  orderBy: { createdAt: "desc" },
  take: 50,
})

// A draft with no heldReason is NOT a failure: the rewrite succeeded and
// the sender has not tapped send yet. describeMessageReason() separates
// that (category "user") from an AI failure (category "ai").`,
    run: async () => {
      const rows = await prisma.message.findMany({
        where: { status: "draft" },
        select: {
          id: true, status: true, heldReason: true, topicTags: true,
          aiProvider: true, aiModel: true, contentRephrased: true,
          createdAt: true,
          sender: { select: { displayName: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return rows.map((row) => withReason({ ...row, contentRephrased: Boolean(row.contentRephrased) }));
    },
  },
  reason_breakdown: {
    title: "Why messages stall (24h)",
    question: "Across the last 24 hours, what is stopping messages, and how much of it needs me?",
    source: `prisma.message.findMany({
  where: {
    createdAt: { gte: ${SINCE_24H} },
    status: { in: ["held", "draft"] },
  },
  select: { status, heldReason, topicTags, contentRephrased },
})

// Grouped by summarizeReasons() in src/lib/message-reasons.js.
// needsAttention = true marks the rows an operator can act on;
// a boundary block and a draft awaiting its author are both false.`,
    run: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await prisma.message.findMany({
        where: { createdAt: { gte: since }, status: { in: ["held", "draft"] } },
        select: {
          status: true, heldReason: true, topicTags: true, contentRephrased: true,
        },
      });
      const summary = summarizeReasons(rows);
      return summary.length > 0
        ? summary
        : [{ reason: "Nothing held or drafted in the last 24 hours", code: "none", category: "ok", count: 0, action: null, needsAttention: false }];
    },
  },
  ai_failures: {
    title: "AI failures (24h)",
    question: "Which AI calls failed or were refused recently?",
    source: `prisma.message.findMany({
  where: {
    heldReason: { in: ["ai_failed", "content_refused"] },
    createdAt: { gte: ${SINCE_24H} },
  },
  select: {
    id, status, heldReason, topicTags, aiProvider, aiModel,
    contentRephrased, createdAt,
    sender: { displayName, username, email },
  },
  orderBy: { createdAt: "desc" },
  take: 50,
})

// "ai_failed" = no provider in the chain answered.
// "content_refused" = a provider answered with a safety refusal, which is
// a verdict on the text and is not retryable as written.`,
    run: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await prisma.message.findMany({
        where: {
          heldReason: { in: ["ai_failed", "content_refused"] },
          createdAt: { gte: since },
        },
        select: {
          id: true, status: true, heldReason: true, topicTags: true,
          aiProvider: true, aiModel: true, contentRephrased: true,
          createdAt: true,
          sender: { select: { displayName: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return rows.map((row) => withReason({ ...row, contentRephrased: Boolean(row.contentRephrased) }));
    },
  },
  all_users: {
    title: "All users",
    question: "Who are the registered users?",
    source: `prisma.user.findMany({
  select: {
    id, email, displayName, username,
    statusText, statusMood, createdAt,
  },
  orderBy: { createdAt: "desc" },
})`,
    run: async () => prisma.user.findMany({
      select: {
        id: true, email: true, displayName: true, username: true,
        statusText: true, statusMood: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  },
  all_connections: {
    title: "All connections",
    question: "What connections exist?",
    source: `prisma.connection.findMany({
  select: {
    id, status, createdAt,
    userA: { displayName, username, email },
    userB: { displayName, username, email },
  },
  orderBy: { createdAt: "desc" },
})`,
    run: async () => prisma.connection.findMany({
      select: {
        id: true, status: true, createdAt: true,
        userA: { select: { displayName: true, username: true, email: true } },
        userB: { select: { displayName: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  },
  topic_settings: {
    title: "Topic boundaries",
    question: "What topic boundaries are configured across all connections?",
    source: `prisma.topicSetting.findMany({
  select: {
    id, topicName, comfortLevel,
    user: { displayName, username, email },
    connection: {
      userA: { displayName, username },
      userB: { displayName, username },
    },
  },
  orderBy: { comfortLevel: "asc" },
  take: 100,
})`,
    run: async () => prisma.topicSetting.findMany({
      select: {
        id: true, topicName: true, comfortLevel: true,
        user: { select: { displayName: true, username: true, email: true } },
        connection: {
          select: {
            userA: { select: { displayName: true, username: true } },
            userB: { select: { displayName: true, username: true } },
          },
        },
      },
      orderBy: { comfortLevel: "asc" },
      take: 100,
    }),
  },
  error_log: {
    title: "Error log",
    question: "What errors have been logged?",
    source: `prisma.logEntry.findMany({
  orderBy: { lastSeenAt: "desc" },
  take: 50,
})`,
    run: async () => prisma.logEntry.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    }),
  },
  table_sizes: {
    title: "Table sizes",
    question: "How big is each table?",
    source: `await Promise.all([
  prisma.user.count(),
  prisma.connection.count(),
  prisma.message.count(),
  prisma.logEntry.count(),
  prisma.topicSetting.count(),
  prisma.wallPost.count(),
  prisma.knowMeEntry.count(),
  prisma.invitation.count(),
])`,
    run: async () => {
      const [users, connections, messages, logEntries, topicSettings, wallPosts, knowMeEntries, invitations] = await Promise.all([
        prisma.user.count(),
        prisma.connection.count(),
        prisma.message.count(),
        prisma.logEntry.count(),
        prisma.topicSetting.count(),
        prisma.wallPost.count(),
        prisma.knowMeEntry.count(),
        prisma.invitation.count(),
      ]);
      return [
        { table: "users", rows: users },
        { table: "connections", rows: connections },
        { table: "messages", rows: messages },
        { table: "log_entries", rows: logEntries },
        { table: "topic_settings", rows: topicSettings },
        { table: "wall_posts", rows: wallPosts },
        { table: "know_me_entries", rows: knowMeEntries },
        { table: "invitations", rows: invitations },
      ];
    },
  },
};

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const catalog = Object.entries(QUERIES).map(([key, q]) => ({
    key,
    title: q.title,
    question: q.question,
    source: q.source,
  }));

  return Response.json({ queries: catalog });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const queryKey = requireString(body.data.query, { maxLength: 64 });
  if (!queryKey || !QUERIES[queryKey]) {
    return badRequest("unknown_query");
  }

  const start = Date.now();
  try {
    const rows = await QUERIES[queryKey].run();
    return Response.json({
      query: queryKey,
      title: QUERIES[queryKey].title,
      question: QUERIES[queryKey].question,
      source: QUERIES[queryKey].source,
      rows: Array.isArray(rows) ? rows : [rows],
      count: Array.isArray(rows) ? rows.length : 1,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || "query_failed", source: QUERIES[queryKey].source },
      { status: 500 }
    );
  }
}
