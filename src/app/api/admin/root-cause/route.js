import { requireAdmin } from "@/lib/admin-auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { getFindings, getRecentLogs } from "@/lib/diagnostics.js";
import { resolveChain, REGISTRY } from "@/lib/ai/index.js";
import { summarizeReasons } from "@/lib/message-reasons.js";
import prisma from "@/lib/db.js";

/**
 * Which agents the operator may ask.
 *
 * Every configured provider is listed, including ones the failover chain
 * would never reach. Comparing two agents on the same question is how you
 * tell "the data says nothing" from "this model is guessing", and the chain
 * order alone hides the second provider's answer completely.
 */
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const chain = resolveChain();
  const chainNames = chain.map((p) => p.name);

  const agents = Object.values(REGISTRY)
    .filter((provider) => provider.isConfigured())
    .map((provider) => ({
      name: provider.name,
      model: provider.defaultModel(),
      // Every model the UI can pin for this provider. Previously only the
      // default was exposed, so an operator could not compare Opus with
      // Haiku on the same question — which is the primary reason to pick a
      // model in the first place.
      models: typeof provider.models === "function" ? provider.models() : [],
      inChain: chainNames.includes(provider.name),
      isDefault: chainNames[0] === provider.name,
    }));

  return Response.json({ agents, chain: chainNames });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const question = requireString(body.data.question, { maxLength: 1000 });
  if (!question) return badRequest("missing_question");

  // No agent named means the normal failover chain. Naming one pins the
  // question to it and skips the fallback, so a provider that is failing
  // shows up as a failure instead of being silently answered by the next one.
  const requestedAgent = body.data.agent === undefined || body.data.agent === null
    ? null
    : requireString(body.data.agent, { maxLength: 32 });

  // Pinning a specific model turns the agent picker into a real tool: Opus
  // and Haiku on the same prompt tell you different things, and the chain
  // picker alone hid every model except the one each provider defaulted to.
  const requestedModel = body.data.model === undefined || body.data.model === null
    ? null
    : requireString(body.data.model, { maxLength: 96 });

  let chain;
  if (requestedAgent) {
    const provider = REGISTRY[requestedAgent];
    if (!provider) return badRequest("unknown_agent");
    if (!provider.isConfigured()) {
      return Response.json({ error: "agent_not_configured", agent: requestedAgent }, { status: 503 });
    }
    chain = [provider];
  } else {
    chain = resolveChain();
  }

  // A model override only makes sense when one agent is pinned — otherwise
  // the chain could reach a provider that has no concept of that model id.
  if (requestedModel && !requestedAgent) return badRequest("model_requires_agent");
  if (requestedModel && chain[0]?.models && !chain[0].models().some((m) => m.id === requestedModel)) {
    // Allow unlisted model ids: a new model may not be in the UI list yet,
    // and the provider API will reject an impossible id itself. The check
    // above is only for a listed agent whose options we actually know.
  }

  if (chain.length === 0) {
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [findings, logs, recentMessages, userCount, connectionCount] = await Promise.all([
    getFindings().catch(() => []),
    getRecentLogs({ limit: 20 }).catch(() => []),
    prisma.message.findMany({
      where: { createdAt: { gte: since } },
      select: {
        status: true, heldReason: true, aiProvider: true, aiModel: true,
        topicTags: true, contentRephrased: true,
      },
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

  // The same breakdown the Data Lens shows, so the agent reasons about the
  // reason a message stalled rather than inferring it from a raw status.
  // Without it, every answer treated a boundary block — the product working —
  // as evidence of a fault.
  const stalled = recentMessages.filter((m) => m.status === "held" || m.status === "draft");
  const reasonLines = summarizeReasons(
    stalled.map((m) => ({ ...m, contentRephrased: Boolean(m.contentRephrased) }))
  ).map((r) => `  ${r.count}× ${r.reason} [${r.category}]${r.needsAttention ? " — needs an operator" : " — no action needed"}`);

  const context = [
    `Leeway is a private two-person messaging app with AI-powered tone tuning and topic boundaries.`,
    `Environment: ${process.env.NODE_ENV || "development"}`,
    `Users: ${userCount}, Active connections: ${connectionCount}`,
    `Messages (24h): ${msgStats.total} total, ${msgStats.sent} sent, ${msgStats.held} held, ${msgStats.draft} drafts, ${msgStats.aiFailed} AI failures`,
    `AI providers configured: ${resolveChain().map((p) => p.name).join(", ") || "none"}`,
    `Answering as: ${chain.map((p) => p.name).join(", ")}${requestedAgent ? " (pinned by the operator, no failover)" : " (failover chain)"}`,
    "",
    `Why messages stalled in the last 24h (${stalled.length} held or draft):`,
    ...(reasonLines.length > 0 ? reasonLines : ["  nothing held or drafted"]),
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
        model: requestedModel || provider.defaultModel(),
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
          pinned: Boolean(requestedAgent),
        },
      });
    } catch {
      continue;
    }
  }

  return Response.json(
    { error: "ai_unavailable", agent: requestedAgent || null },
    { status: 503 }
  );
}
