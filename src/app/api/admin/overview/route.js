import { requireAdmin } from "@/lib/admin-auth.js";
import { getFindings, getMetrics, getRecentLogs } from "@/lib/diagnostics.js";
import { logError } from "@/lib/logger.js";
import { summarizeUsage, projectMonthly } from "@/lib/ai/pricing.js";
import prisma from "@/lib/db.js";

/**
 * AI spend over several windows. Reads every message in the window rather
 * than the 50-row sample `getRecentAICalls` returns, because a cost total
 * built from a truncated sample would understate spend without saying so.
 */
async function getCostEstimates() {
  const windows = [
    { key: "last24h", days: 1 },
    { key: "last7d", days: 7 },
    { key: "last30d", days: 30 },
  ];

  const out = {};
  for (const { key, days } of windows) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.message.findMany({
      where: { createdAt: { gte: since }, aiTokensUsed: { not: null } },
      select: { aiModel: true, aiTokensUsed: true, senderId: true },
    });

    const summary = summarizeUsage(
      rows.map((r) => ({ model: r.aiModel, tokens: r.aiTokensUsed, userId: r.senderId }))
    );

    out[key] = {
      ...summary,
      windowDays: days,
      projectedMonthlyUsd: projectMonthly(summary.totalUsd, days),
    };
  }

  // Active users in the last 30 days, so cost-per-user reflects people who
  // actually sent something rather than everyone who ever signed up.
  const activeSenders = await prisma.message.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    select: { senderId: true },
    distinct: ["senderId"],
  });

  return { ...out, activeUsers30d: activeSenders.length };
}

async function getUserIssues() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const usersWithHeldMessages = await prisma.message.groupBy({
    by: ["senderId"],
    _count: true,
    where: { status: "held", createdAt: { gte: since } },
    orderBy: { _count: { senderId: "desc" } },
    take: 10,
  });

  const usersWithDrafts = await prisma.message.groupBy({
    by: ["senderId"],
    _count: true,
    where: { status: "draft", createdAt: { gte: since } },
    orderBy: { _count: { senderId: "desc" } },
    take: 10,
  });

  const userIds = [...new Set([
    ...usersWithHeldMessages.map((u) => u.senderId),
    ...usersWithDrafts.map((u) => u.senderId),
  ])];

  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, displayName: true, username: true },
      })
    : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.displayName || u.username || u.email]));

  return {
    heldPerUser: usersWithHeldMessages.map((u) => ({
      name: userMap[u.senderId] || u.senderId,
      count: u._count,
    })),
    draftsPerUser: usersWithDrafts.map((u) => ({
      name: userMap[u.senderId] || u.senderId,
      count: u._count,
    })),
  };
}

async function getRecentAICalls() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const messages = await prisma.message.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      aiProvider: true,
      aiModel: true,
      aiTokensUsed: true,
      status: true,
      heldReason: true,
      createdAt: true,
      sender: { select: { displayName: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return messages.map((m) => ({
    id: m.id,
    provider: m.aiProvider,
    model: m.aiModel,
    tokens: m.aiTokensUsed,
    status: m.status,
    heldReason: m.heldReason,
    sender: m.sender.displayName || m.sender.username || m.sender.email,
    createdAt: m.createdAt.toISOString(),
  }));
}

async function getUserList() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true,
      statusText: true,
      statusMood: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return users.map((u) => ({
    id: u.id,
    name: u.displayName || u.username || u.email,
    email: u.email,
    status: u.statusText,
    mood: u.statusMood,
    joined: u.createdAt.toISOString(),
  }));
}

async function getConnectionList() {
  const connections = await prisma.connection.findMany({
    where: { status: "active" },
    select: {
      id: true,
      createdAt: true,
      userA: { select: { displayName: true, username: true, email: true } },
      userB: { select: { displayName: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return connections.map((c) => ({
    id: c.id,
    personA: c.userA.displayName || c.userA.username || c.userA.email,
    personB: c.userB.displayName || c.userB.username || c.userB.email,
    since: c.createdAt.toISOString(),
  }));
}

async function getRecentMessages(status, limit = 20) {
  const messages = await prisma.message.findMany({
    where: { status },
    select: {
      id: true,
      contentRaw: true,
      heldReason: true,
      topicTags: true,
      aiProvider: true,
      status: true,
      createdAt: true,
      sender: { select: { displayName: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return messages.map((m) => ({
    id: m.id,
    preview: m.contentRaw?.slice(0, 80) + (m.contentRaw?.length > 80 ? "..." : ""),
    heldReason: m.heldReason,
    topics: m.topicTags,
    provider: m.aiProvider,
    sender: m.sender.displayName || m.sender.username || m.sender.email,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const [findings, metrics, logs, userIssues, costs, aiCalls, users, connections, heldMessages, draftMessages] = await Promise.all([
    getFindings().catch((err) => {
      logError("api.admin.overview", "findings unavailable", err?.message);
      return null;
    }),
    getMetrics().catch((err) => {
      logError("api.admin.overview", "metrics unavailable", err?.message);
      return null;
    }),
    getRecentLogs({ limit: 50 }).catch((err) => {
      logError("api.admin.overview", "log list unavailable", err?.message);
      return null;
    }),
    getUserIssues().catch((err) => {
      logError("api.admin.overview", "user issues unavailable", err?.message);
      return null;
    }),
    getCostEstimates().catch((err) => {
      logError("api.admin.overview", "cost estimates unavailable", err?.message);
      return null;
    }),
    getRecentAICalls().catch(() => []),
    getUserList().catch(() => []),
    getConnectionList().catch(() => []),
    getRecentMessages("held").catch(() => []),
    getRecentMessages("draft").catch(() => []),
  ]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    viewer: auth.user.email,
    findings,
    metrics,
    logs,
    userIssues,
    costs,
    details: {
      aiCalls,
      users,
      connections,
      heldMessages,
      draftMessages,
    },
  });
}
