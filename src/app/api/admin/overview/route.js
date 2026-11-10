import { checkAdmin } from "@/lib/admin-auth.js";
import { getFindings, getMetrics, getRecentLogs } from "@/lib/diagnostics.js";
import { logError } from "@/lib/logger.js";

export async function GET(request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return auth.response;

  // Each source is fetched independently: a diagnostic that needs a healthy
  // database must not take the whole page down at the exact moment the
  // database is what you are trying to diagnose.
  const [findings, metrics, logs] = await Promise.all([
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
  ]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    findings,
    metrics,
    logs,
  });
}
