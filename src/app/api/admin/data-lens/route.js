import { requireAdmin } from "@/lib/admin-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import prisma from "@/lib/db.js";

const QUERIES = {
  recent_messages: {
    title: "Recent messages",
    question: "What messages were sent in the last 24 hours?",
    run: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return prisma.message.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true, status: true, heldReason: true, aiProvider: true, aiModel: true,
          aiTokensUsed: true, topicTags: true, createdAt: true,
          sender: { select: { displayName: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    },
  },
  all_users: {
    title: "All users",
    question: "Who are the registered users?",
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
    run: async () => prisma.connection.findMany({
      select: {
        id: true, status: true, createdAt: true,
        userA: { select: { displayName: true, username: true, email: true } },
        userB: { select: { displayName: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  },
  held_messages: {
    title: "Held messages",
    question: "What messages have been held by the guardian?",
    run: async () => prisma.message.findMany({
      where: { status: "held" },
      select: {
        id: true, contentRaw: true, heldReason: true, topicTags: true,
        createdAt: true,
        sender: { select: { displayName: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  },
  draft_messages: {
    title: "Unsent drafts",
    question: "What messages are stuck as drafts?",
    run: async () => prisma.message.findMany({
      where: { status: "draft" },
      select: {
        id: true, heldReason: true, aiProvider: true, createdAt: true,
        sender: { select: { displayName: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  },
  ai_failures: {
    title: "AI failures (24h)",
    question: "Which AI calls failed recently?",
    run: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return prisma.message.findMany({
        where: { heldReason: "ai_failed", createdAt: { gte: since } },
        select: {
          id: true, aiProvider: true, aiModel: true, createdAt: true,
          sender: { select: { displayName: true, username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    },
  },
  topic_settings: {
    title: "Topic boundaries",
    question: "What topic boundaries are configured across all connections?",
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
    run: async () => prisma.logEntry.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    }),
  },
  table_sizes: {
    title: "Table sizes",
    question: "How big is each table?",
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
      rows: Array.isArray(rows) ? rows : [rows],
      count: Array.isArray(rows) ? rows.length : 1,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return Response.json({ error: err?.message || "query_failed" }, { status: 500 });
  }
}
