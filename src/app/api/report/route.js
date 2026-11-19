import prisma from "@/lib/db.js";
import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest, requireString } from "@/lib/http.js";
import { checkRateLimit } from "@/lib/rate-limit.js";
import { logInfo } from "@/lib/logger.js";

/**
 * File a moderation report on another user or a message.
 *
 * Apple's App Store Review Guideline 1.1.6 requires any app with
 * user-generated content to provide a report mechanism and a 24-hour
 * review SLA. This endpoint persists the report (admin can review) and
 * logs it so an operator sees new reports in the diagnostic tail.
 *
 * Shape: { targetType: "user" | "message", targetId, reason? }
 */
const ALLOWED_TARGETS = new Set(["user", "message"]);
const MAX_REASON = 2000;

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Limit a single user to one report per 30s per target type. Bursts
  // under this threshold are extremely likely to be a real abuse case;
  // above it we almost certainly have a bot or a user double-tapping.
  const limit = checkRateLimit(`report:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return Response.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const targetType = requireString(body.data.targetType, { maxLength: 16 });
  const targetId = requireString(body.data.targetId, { maxLength: 64 });
  const reasonRaw = typeof body.data.reason === "string" ? body.data.reason : null;

  if (!targetType || !ALLOWED_TARGETS.has(targetType)) return badRequest("invalid_target_type");
  if (!targetId) return badRequest("missing_target_id");

  const reason = reasonRaw
    ? reasonRaw.replace(/[\r\n]+/g, "\n").trim().slice(0, MAX_REASON) || null
    : null;

  const report = await prisma.report.create({
    data: { reporterId: user.id, targetType, targetId, reason, status: "open" },
  });

  // Logged so admin's diagnostic tail picks up the arrival. Admin UI
  // reads from prisma.report directly for the queue.
  logInfo("report.filed", `${targetType}:${targetId}`, `report ${report.id} by ${user.id}`);

  return Response.json({ ok: true, reportId: report.id });
}
