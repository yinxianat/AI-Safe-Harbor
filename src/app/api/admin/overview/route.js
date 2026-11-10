import { requireAdmin } from "@/lib/admin-auth.js";
import { getFindings, getMetrics, getRecentLogs } from "@/lib/diagnostics.js";
import { logError } from "@/lib/logger.js";
import prisma from "@/lib/db.js";

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

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const [findings, metrics, logs, userIssues] = await Promise.all([
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
  ]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    viewer: auth.user.email,
    findings,
    metrics,
    logs,
    userIssues,
  });
}
