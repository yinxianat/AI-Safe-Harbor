import prisma from "./db.js";

/**
 * Product-outcome metrics for the admin overview.
 *
 * The existing overview counted things — users, messages, tokens — and
 * returned recent-message previews that included body text. A product owner
 * can't make a decision off those numbers in isolation: "we have 180 users"
 * doesn't say whether the app is helping anybody. These metrics answer the
 * questions a product owner actually asks:
 *
 *   - Are people getting through? (send-through rate)
 *   - Are the connections actually used? (active pairs, median messages)
 *   - Is the AI pulling its weight? (approval rate, model distribution)
 *   - How is cost trending? (per-active-user, week-over-week)
 *   - Are we growing or losing people? (DAU, WAU, retention)
 *
 * Every function here returns a shape the UI can render without further
 * reshaping. Nothing reads a message body, status text or free-text note:
 * the overview is a dashboard, and bodies belong in Data Lens where they
 * aren't returned at all.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const since = (days) => new Date(Date.now() - days * DAY_MS);

/**
 * Daily counts of sent / held / draft messages across a window.
 *
 * Grouped on the server with date_trunc so we aren't shipping every row to
 * JS. Returns rows ordered by day ascending so the UI can plot it left to
 * right without a client-side sort.
 */
async function messagesPerDay(days = 14) {
  const sinceDate = since(days);
  const rows = await prisma.$queryRaw`
    SELECT
      to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
      SUM(CASE WHEN "status" = 'sent' THEN 1 ELSE 0 END)::int AS sent,
      SUM(CASE WHEN "status" = 'held' THEN 1 ELSE 0 END)::int AS held,
      SUM(CASE WHEN "status" = 'draft' THEN 1 ELSE 0 END)::int AS draft
    FROM "Message"
    WHERE "createdAt" >= ${sinceDate}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    day: r.day,
    sent: Number(r.sent),
    held: Number(r.held),
    draft: Number(r.draft),
  }));
}

/**
 * Compose health: what the AI pipeline did with the messages people wrote.
 *
 * Approved share is what matters: a message that was rephrased but the
 * sender did NOT approve means the AI's rewrite was worse than the raw text
 * from the sender's point of view. That's a quality signal nothing else
 * tracks.
 */
async function composeHealth(days = 7) {
  const sinceDate = since(days);
  const groups = await prisma.message.groupBy({
    by: ["status", "senderApproved", "versionSent"],
    _count: true,
    where: { createdAt: { gte: sinceDate } },
  });

  let composed = 0;
  let sent = 0;
  let sentApproved = 0;
  let sentRaw = 0;
  let held = 0;
  let draftWaiting = 0;

  for (const g of groups) {
    composed += g._count;
    if (g.status === "sent") {
      sent += g._count;
      if (g.senderApproved) sentApproved += g._count;
      if (g.versionSent === "raw") sentRaw += g._count;
    } else if (g.status === "held") {
      held += g._count;
    } else if (g.status === "draft") {
      draftWaiting += g._count;
    }
  }

  return {
    windowDays: days,
    composed,
    sent,
    held,
    draftWaiting,
    // Share the AI's rewrite was accepted when a message was sent. A low
    // number means people are falling back to raw or abandoning the draft.
    approvalRate: sent > 0 ? sentApproved / sent : null,
    // Share of sends that bypassed AI rewrite entirely (raw send). High =
    // the AI's output is often seen as not worth sending.
    rawSendRate: sent > 0 ? sentRaw / sent : null,
    // Share of compose attempts that reached the receiver.
    sendThroughRate: composed > 0 ? sent / composed : null,
  };
}

async function modelBreakdown(days = 7) {
  const sinceDate = since(days);
  const groups = await prisma.message.groupBy({
    by: ["aiModel", "status"],
    _count: true,
    _sum: { aiTokensUsed: true },
    where: { createdAt: { gte: sinceDate }, aiModel: { not: null } },
  });

  const byModel = new Map();
  for (const g of groups) {
    const row = byModel.get(g.aiModel) || {
      model: g.aiModel, sent: 0, held: 0, draft: 0, total: 0, tokens: 0,
    };
    row.total += g._count;
    row.tokens += g._sum.aiTokensUsed || 0;
    if (g.status === "sent") row.sent += g._count;
    else if (g.status === "held") row.held += g._count;
    else if (g.status === "draft") row.draft += g._count;
    byModel.set(g.aiModel, row);
  }
  // Highest-volume first so the operator sees the model their users actually
  // hit most, not an alphabetical list.
  return [...byModel.values()].sort((a, b) => b.total - a.total);
}

/**
 * How active people actually are.
 *
 * Senders rather than sessions: this app has no event log for logins. A
 * person who sent a message was present; that's the honest proxy.
 */
async function activity() {
  const now = new Date();
  const [totalUsers, totalConnections, activeConnections, senders1d, senders7d, senders30d] = await Promise.all([
    prisma.user.count(),
    prisma.connection.count(),
    prisma.connection.count({ where: { status: "active" } }),
    prisma.message.findMany({
      where: { createdAt: { gte: since(1) } },
      select: { senderId: true },
      distinct: ["senderId"],
    }),
    prisma.message.findMany({
      where: { createdAt: { gte: since(7) } },
      select: { senderId: true },
      distinct: ["senderId"],
    }),
    prisma.message.findMany({
      where: { createdAt: { gte: since(30) } },
      select: { senderId: true },
      distinct: ["senderId"],
    }),
  ]);

  return {
    totalUsers,
    totalConnections,
    activeConnections,
    dau: senders1d.length,
    wau: senders7d.length,
    mau: senders30d.length,
    // DAU/MAU is the "stickiness" number product people live and die by.
    // Null when MAU is 0 so we don't divide and report a bogus percentage.
    stickiness: senders30d.length > 0 ? senders1d.length / senders30d.length : null,
    windowAsOf: now.toISOString(),
  };
}

/**
 * Activity per CONNECTION, not per user. The product is a two-person
 * surface; a connection where only one side ever talks is a half-dead
 * relationship, and the number worth watching.
 */
async function connectionHealth(days = 7) {
  const sinceDate = since(days);
  const groups = await prisma.message.groupBy({
    by: ["connectionId"],
    _count: true,
    where: { status: "sent", createdAt: { gte: sinceDate } },
  });
  const counts = groups.map((g) => g._count).sort((a, b) => a - b);
  const median = counts.length === 0
    ? null
    : counts.length % 2 === 1
      ? counts[(counts.length - 1) / 2]
      : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2;

  return {
    windowDays: days,
    activeConnections: groups.length,
    medianMessages: median,
    topTenth: counts.length >= 10 ? counts[Math.floor(counts.length * 0.9)] : null,
  };
}

/**
 * New users and new connections, per week, over the last month.
 *
 * Returned as the two series for an operator to render as a single
 * growth chart.
 */
async function growth(weeks = 4) {
  const sinceDate = since(weeks * 7);
  const [usersRaw, connsRaw] = await Promise.all([
    prisma.$queryRaw`
      SELECT to_char(date_trunc('week', "createdAt"), 'YYYY-MM-DD') AS week, COUNT(*)::int AS n
      FROM "User"
      WHERE "createdAt" >= ${sinceDate}
      GROUP BY 1 ORDER BY 1 ASC`,
    prisma.$queryRaw`
      SELECT to_char(date_trunc('week', "createdAt"), 'YYYY-MM-DD') AS week, COUNT(*)::int AS n
      FROM "Connection"
      WHERE "createdAt" >= ${sinceDate}
      GROUP BY 1 ORDER BY 1 ASC`,
  ]);

  return {
    weeks,
    newUsers: usersRaw.map((r) => ({ week: r.week, count: Number(r.n) })),
    newConnections: connsRaw.map((r) => ({ week: r.week, count: Number(r.n) })),
  };
}

/**
 * The top boundary topics across all connections.
 *
 * Only the TOPIC name is returned, never any user's note. This is the
 * kind of thing the product owner wants to know ("People are nervous
 * about Money and Health") without reading anyone's private boundaries.
 */
async function topBoundaries() {
  const rows = await prisma.topicSetting.groupBy({
    by: ["topicName", "comfortLevel"],
    _count: true,
    where: { comfortLevel: { in: ["red", "yellow"] } },
    orderBy: { _count: { topicName: "desc" } },
    take: 20,
  });
  return rows.map((r) => ({
    topic: r.topicName,
    level: r.comfortLevel,
    count: r._count,
  }));
}

export async function computeOutcomes() {
  const [daily, compose, models, act, pairs, growthData, boundaries] = await Promise.all([
    messagesPerDay(14),
    composeHealth(7),
    modelBreakdown(7),
    activity(),
    connectionHealth(7),
    growth(4),
    topBoundaries(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    messagesPerDay: daily,
    composeHealth: compose,
    modelBreakdown: models,
    activity: act,
    connectionHealth: pairs,
    growth: growthData,
    topBoundaries: boundaries,
  };
}
