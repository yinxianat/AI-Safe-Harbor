import { requireAdmin } from "@/lib/admin-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { getFindings, getRecentLogs } from "@/lib/diagnostics.js";
import { resolveChain } from "@/lib/ai/index.js";
import prisma from "@/lib/db.js";

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const question = requireString(body.data.question, { maxLength: 1000 });
  if (!question) return badRequest("missing_question");

  const chain = resolveChain();
  if (chain.length === 0) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [findings, logs, recentMessages, userCount, connectionCount] = await Promise.all([
    getFindings().catch(() => []),
    getRecentLogs({ limit: 20 }).catch(() => []),
    prisma.message.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, heldReason: true, aiProvider: true, aiModel: true },
      take: 100,
    }),
    prisma.user.count(),
    prisma.connection.count({ where: { status: "active" } }),
  ]);

  const unresolvedLogs = logs.filter((l) => !l.resolved);
  const msgStats = {
    total: recentMessages.length,
    sent: recentMessages.filter((m) => m.status === "sent").length,
    held: recentMessages.filter((m) => m.status === "held").length,
    draft: recentMessages.filter((m) => m.status === "draft").length,
    aiFailed: recentMessages.filter((m) => m.heldReason === "ai_failed").length,
  };

  const context = [
    `Leeway is a private two-person messaging app with AI-powered tone tuning and topic boundaries.`,
    `Environment: ${process.env.NODE_ENV || "development"}`,
    `Users: ${userCount}, Active connections: ${connectionCount}`,
    `Messages (24h): ${msgStats.total} total, ${msgStats.sent} sent, ${msgStats.held} held, ${msgStats.draft} drafts, ${msgStats.aiFailed} AI failures`,
    `AI providers configured: ${chain.map((p) => p.name).join(", ")}`,
    "",
    `Active findings (${findings.length}):`,
    ...findings.map((f) => `  [${f.severity}] ${f.title}: ${f.detail}`),
    "",
    `Unresolved error log (${unresolvedLogs.length}):`,
    ...unresolvedLogs.map((l) => `  [${l.level}] ${l.source}: ${l.message}${l.detail ? ` — ${l.detail}` : ""} (×${l.count}, last ${l.lastSeenAt})`),
  ].join("\n");

  const system = `You are a diagnostic assistant for Leeway, a private messaging app. You have access to the app's current monitoring data. Answer the admin's question using ONLY the context provided. Be specific and actionable.

Respond in this JSON format:
{"cause":"one-line headline","answer":"2-3 sentence explanation","fix":[{"step":"what to do","where":"file or setting"}],"verify":"how to confirm the fix worked","confidence":"high|medium|low"}

Context:
${context}`;

  const start = Date.now();
  for (const provider of chain) {
    try {
      const result = await provider.complete({
        system,
        userMessage: question,
        model: provider.defaultModel(),
        maxTokens: 1024,
      });

      let parsed;
      try {
        parsed = JSON.parse(result.text.replace(/```json\n?|```/g, "").trim());
      } catch {
        parsed = { cause: "Analysis complete", answer: result.text, fix: [], confidence: "medium" };
      }

      return Response.json({
        ...parsed,
        meta: {
          provider: provider.name,
          model: result.model,
          tokens: result.tokensUsed,
          durationMs: Date.now() - start,
        },
      });
    } catch {
      continue;
    }
  }

  return Response.json({ error: "ai_unavailable" }, { status: 503 });
}
