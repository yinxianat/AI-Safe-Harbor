import prisma from "./db.js";
import { resolveChain } from "./ai/index.js";

// Findings are DERIVED on every read, never stored. A stored finding that some
// cleanup job forgot to update silently misleads; a derived one is always
// current because it is always recomputed.

// Titles live in one catalogue so wording cannot drift between two findings
// that share a code. `tests/diagnostics.test.js` fails the build if a code is
// emitted with no title here.
export const FINDING_TITLES = {
  missing_secret: "Required secret is not set",
  missing_base_url: "BASE_URL is not set in production",
  no_ai_provider: "No AI provider is configured",
  single_ai_provider: "No AI fallback provider configured",
  no_admin_email: "No administrators configured",
  smtp_not_configured: "Email delivery is not configured",
  errors_logged: "Errors recorded recently",
  critical_logged: "Critical errors recorded recently",
  ai_failures: "Messages held because AI was unavailable",
  drafts_piling_up: "Unsent drafts accumulating",
  no_connections: "No active connections",
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export async function getFindings() {
  const findings = [];
  const add = (f) => findings.push({ ...f, title: FINDING_TITLES[f.code] });

  // --- Configuration -------------------------------------------------------
  for (const name of ["JWT_SECRET", "MAGIC_LINK_SECRET"]) {
    if (!process.env[name]) {
      add({
        severity: "high",
        code: "missing_secret",
        subject: name,
        detail: `${name} is not set. Authentication will fail for every request.`,
        remediation: `Set ${name} in the deployment environment and redeploy.`,
      });
    }
  }

  if (process.env.NODE_ENV === "production" && !process.env.BASE_URL) {
    add({
      severity: "high",
      code: "missing_base_url",
      subject: null,
      detail: "Magic links cannot be generated; sign-in and invites are broken.",
      remediation: "Set BASE_URL to the public origin, e.g. https://your-app.up.railway.app",
    });
  }

  const chain = resolveChain();
  if (chain.length === 0) {
    add({
      severity: "high",
      code: "no_ai_provider",
      subject: null,
      detail: "No provider in AI_PROVIDER_CHAIN has an API key. Every message will be held as a draft.",
      remediation: "Set GEMINI_API_KEY (or another provider's key).",
    });
  } else if (chain.length === 1) {
    add({
      severity: "low",
      code: "single_ai_provider",
      subject: chain[0].name,
      detail: `Only ${chain[0].name} is configured, so there is no failover if it goes down.`,
      remediation: "Add a second provider key, e.g. ANTHROPIC_API_KEY.",
    });
  }

  if (!process.env.ADMIN_EMAILS) {
    add({
      severity: "medium",
      code: "no_admin_email",
      subject: null,
      detail: "No one can open /admin and no error alerts are sent.",
      remediation: "Set ADMIN_EMAILS to a comma-separated list of administrator addresses.",
    });
  }

  if (!process.env.SMTP_HOST) {
    add({
      severity: "medium",
      code: "smtp_not_configured",
      subject: null,
      detail: "Magic links are written to the server log instead of emailed, so only someone with log access can sign in.",
      remediation: "Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.",
    });
  }

  // --- Runtime -------------------------------------------------------------
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [errorGroups, aiFailures, drafts, connections] = await Promise.all([
    prisma.logEntry.groupBy({
      by: ["level"],
      where: { lastSeenAt: { gte: since }, resolvedAt: null },
      _sum: { count: true },
    }),
    prisma.message.count({ where: { heldReason: "ai_failed", createdAt: { gte: since } } }),
    prisma.message.count({ where: { status: "draft" } }),
    prisma.connection.count({ where: { status: "active" } }),
  ]);

  const bucket = (level) =>
    errorGroups.find((g) => g.level === level)?._sum.count ?? 0;

  const criticals = bucket("critical");
  const errors = bucket("error");

  if (criticals > 0) {
    add({
      severity: "high",
      code: "critical_logged",
      subject: null,
      detail: `${criticals} critical occurrence(s) in the last 24 hours.`,
      remediation: "Review the error log below.",
      evidence: { count: criticals },
    });
  }

  if (errors > 0) {
    add({
      severity: errors > 50 ? "high" : "medium",
      code: "errors_logged",
      subject: null,
      detail: `${errors} error occurrence(s) in the last 24 hours.`,
      remediation: "Review the error log below.",
      evidence: { count: errors },
    });
  }

  if (aiFailures > 0) {
    add({
      severity: aiFailures > 10 ? "high" : "medium",
      code: "ai_failures",
      subject: null,
      detail: `${aiFailures} message(s) held in the last 24 hours because no AI provider answered.`,
      remediation: "Check provider keys and quota. Messages are safe as drafts and can be retried.",
      evidence: { count: aiFailures },
    });
  }

  if (drafts > 20) {
    add({
      severity: "low",
      code: "drafts_piling_up",
      subject: null,
      detail: `${drafts} unsent drafts. Expected if people compose and abandon; worth a look if it keeps climbing.`,
      remediation: null,
      evidence: { count: drafts },
    });
  }

  if (connections === 0) {
    add({
      severity: "low",
      code: "no_connections",
      subject: null,
      detail: "Nobody has completed an invitation yet.",
      remediation: "Expected on a fresh deployment.",
    });
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return findings;
}

export async function getMetrics() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [users, connections, sent, held, drafts, recent, tokens] = await Promise.all([
    prisma.user.count(),
    prisma.connection.count({ where: { status: "active" } }),
    prisma.message.count({ where: { status: "sent" } }),
    prisma.message.count({ where: { status: "held" } }),
    prisma.message.count({ where: { status: "draft" } }),
    prisma.message.count({ where: { createdAt: { gte: since } } }),
    prisma.message.aggregate({ _sum: { aiTokensUsed: true } }),
  ]);

  const [aiSucceeded, aiFailed, aiRefused, providerBreakdown, heldByReason] = await Promise.all([
    prisma.message.count({ where: { contentRephrased: { not: null }, createdAt: { gte: since } } }),
    prisma.message.count({ where: { heldReason: "ai_failed", createdAt: { gte: since } } }),
    prisma.message.count({ where: { heldReason: "content_refused", createdAt: { gte: since } } }),
    prisma.message.groupBy({ by: ["aiProvider"], _count: true, where: { createdAt: { gte: since }, aiProvider: { not: null } } }),
    prisma.message.groupBy({ by: ["heldReason"], _count: true, where: { status: "held" } }),
  ]);

  return {
    users,
    connections,
    messagesSent: sent,
    messagesHeld: held,
    messagesDraft: drafts,
    messagesLast24h: recent,
    aiTokensTotal: tokens._sum.aiTokensUsed ?? 0,
    aiProviders: resolveChain().map((p) => ({ name: p.name, model: p.defaultModel() })),
    aiPipeline: {
      succeeded24h: aiSucceeded,
      failed24h: aiFailed,
      refused24h: aiRefused,
      successRate: recent > 0 ? Math.round((aiSucceeded / Math.max(aiSucceeded + aiFailed + aiRefused, 1)) * 100) : null,
      byProvider: providerBreakdown.map((p) => ({ provider: p.aiProvider, count: p._count })),
    },
    heldReasons: heldByReason.map((r) => ({ reason: r.heldReason || "unknown", count: r._count })),
  };
}

export async function getRecentLogs({ limit = 50 } = {}) {
  const entries = await prisma.logEntry.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: Math.min(limit, 200),
  });

  return entries.map((e) => ({
    id: e.id,
    level: e.level,
    source: e.source,
    message: e.message,
    detail: e.detail,
    count: e.count,
    firstSeenAt: e.firstSeenAt.toISOString(),
    lastSeenAt: e.lastSeenAt.toISOString(),
    resolved: e.resolvedAt !== null,
  }));
}
