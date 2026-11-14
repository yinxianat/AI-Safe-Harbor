"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SEVERITY_STYLE = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

const LEVEL_STYLE = {
  critical: "bg-red-100 text-red-700",
  error: "bg-orange-100 text-orange-700",
  warn: "bg-amber-100 text-amber-700",
};

const AI_STATUS_STYLE = {
  sent: "text-emerald-700 bg-emerald-50",
  draft: "text-amber-700 bg-amber-50",
  held: "text-red-700 bg-red-50",
};

const CONFIDENCE_STYLE = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
};

function Gate({ title, children }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

async function fetchOverview() {
  try {
    const res = await fetch("/api/admin/overview");
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      return { gate: "unconfigured", message: body.detail };
    }
    if (res.status === 401) return { gate: "signed_out" };
    if (res.status === 403) return { gate: "forbidden" };
    if (!res.ok) return { gate: "error", message: `Request failed (${res.status}).` };
    return { data: await res.json() };
  } catch {
    return { gate: "error", message: "Could not reach the server." };
  }
}

function StatCard({ label, value, hint, detail }) {
  const [open, setOpen] = useState(false);
  const hasDetail = detail && detail.length > 0;

  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => hasDetail && setOpen(!open)}
        className={`w-full p-3 sm:p-4 text-left ${hasDetail ? "cursor-pointer hover:bg-slate-50 transition-colors" : "cursor-default"}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          {hasDetail && (
            <svg className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
        <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] sm:text-xs text-slate-400 truncate">{hint}</p>}
      </button>
      {open && hasDetail && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-3 sm:px-4 py-2 sm:py-3 max-h-64 overflow-y-auto">
          {detail.map((row, i) => (
            <div key={i} className="flex items-center gap-2 sm:gap-3 py-1.5 text-xs sm:text-sm border-b border-slate-50 last:border-0">
              <span className="flex-1 text-slate-700 truncate">{row.primary}</span>
              {row.secondary && <span className="shrink-0 text-[10px] sm:text-xs text-slate-400">{row.secondary}</span>}
              {row.badge && (
                <span className={`shrink-0 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${row.badgeStyle || "bg-slate-100 text-slate-600"}`}>
                  {row.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeverityLane({ title, count, color, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const borderColor = color === "red" ? "border-l-red-500" : color === "amber" ? "border-l-amber-400" : "border-l-slate-300";

  return (
    <div className={`rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden border-l-4 ${borderColor}`}>
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            color === "red" ? "bg-red-100 text-red-700" : color === "amber" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
          }`}>{count}</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [state, setState] = useState({ status: "loading" });
  const [showResolved, setShowResolved] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const load = useCallback(async () => {
    const result = await fetchOverview();
    setState(
      result.data
        ? { status: "ready", data: result.data }
        : { status: result.gate, message: result.message }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOverview().then((result) => {
      if (cancelled) return;
      setState(
        result.data
          ? { status: "ready", data: result.data }
          : { status: result.gate, message: result.message }
      );
    });
    return () => { cancelled = true; };
  }, []);

  async function resolveLog(id) {
    await fetch("/api/admin/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (state.status === "unconfigured") {
    return (
      <Gate title="Admin is not configured">
        <p>
          No administrators are set. Add{" "}
          <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code> to the
          environment and redeploy.
        </p>
      </Gate>
    );
  }

  if (state.status === "signed_out") {
    return (
      <Gate title="Sign in required">
        <p>Administrators are recognised by the address on their account.</p>
        <Link href="/" className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700">
          Go to sign in
        </Link>
        <Link href="/admin/pin" className="mt-3 inline-block text-sm text-slate-500 hover:text-slate-700 hover:underline">
          Email delivery broken? Use the admin PIN
        </Link>
      </Gate>
    );
  }

  if (state.status === "forbidden") {
    return (
      <Gate title="Not available">
        <p>This account does not have administrator access.</p>
        <Link href="/circle" className="mt-4 inline-block text-emerald-600 underline">Back to Leeway</Link>
      </Gate>
    );
  }

  if (state.status === "error") {
    return (
      <Gate title="Something went wrong">
        <p>{state.message}</p>
        <button onClick={load} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Try again
        </button>
      </Gate>
    );
  }

  const { findings, metrics, logs, environment, generatedAt, viewer, userIssues, details, costs, outcomes } = state.data;
  const unresolvedLogs = logs?.filter((l) => !l.resolved) || [];
  const resolvedLogs = logs?.filter((l) => l.resolved) || [];

  const highFindings = findings?.filter((f) => f.severity === "high") || [];
  const medFindings = findings?.filter((f) => f.severity === "medium") || [];
  const lowFindings = findings?.filter((f) => f.severity === "low") || [];

  const headlineText = highFindings.length > 0
    ? `${highFindings.length} thing${highFindings.length > 1 ? "s" : ""} need${highFindings.length === 1 ? "s" : ""} attention now`
    : medFindings.length > 0
      ? `${medFindings.length} thing${medFindings.length > 1 ? "s" : ""} worth a look — nothing urgent`
      : "Nothing needs attention right now";

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "ai", label: "AI Calls" },
    { key: "logs", label: `Errors${unresolvedLogs.length > 0 ? ` (${unresolvedLogs.length})` : ""}` },
    { key: "data-lens", label: "Data Lens" },
    { key: "root-cause", label: "Root Cause" },
    { key: "infra", label: "Infrastructure" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900">Admin</h1>
          <p className="mt-0.5 text-[10px] sm:text-sm text-slate-500 truncate">
            {environment}{viewer ? ` · ${viewer}` : ""} · {new Date(generatedAt).toLocaleString()}
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-200 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </header>

      {/* Headline card */}
      <div className={`rounded-xl border-l-4 border p-3 sm:p-4 ${
        highFindings.length > 0
          ? "border-l-red-500 border-red-200 bg-red-50 text-red-800"
          : medFindings.length > 0
            ? "border-l-amber-400 border-amber-200 bg-amber-50 text-amber-800"
            : "border-l-emerald-500 border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}>
        <p className="text-sm sm:text-base font-semibold">{headlineText}</p>
        <p className="mt-0.5 text-xs sm:text-sm">
          {highFindings.length > 0
            ? highFindings[0].detail
            : "Configuration looks complete and nothing critical was logged."}
        </p>
      </div>

      {/* Tab navigation — horizontal scroll on phone */}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px -mx-3 px-3 sm:-mx-0 sm:px-0 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors rounded-t-lg shrink-0 ${
              activeTab === tab.key
                ? "bg-white border border-slate-200 border-b-white text-emerald-700 -mb-px"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div>
        {activeTab === "overview" && (
          <OverviewTab metrics={metrics} findings={findings} userIssues={userIssues} details={details}
            outcomes={outcomes} costs={costs}
            highFindings={highFindings} medFindings={medFindings} lowFindings={lowFindings} />
        )}
        {activeTab === "ai" && <AICallsTab details={details} metrics={metrics} costs={costs} />}
        {activeTab === "logs" && (
          <LogsTab logs={showResolved ? logs : unresolvedLogs}
            unresolvedCount={unresolvedLogs.length} resolvedCount={resolvedLogs.length}
            showResolved={showResolved} setShowResolved={setShowResolved} resolveLog={resolveLog} />
        )}
        {activeTab === "data-lens" && <DataLensTab />}
        {activeTab === "root-cause" && <RootCauseTab />}
        {activeTab === "infra" && <InfraTab findings={findings} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({
  metrics,
  userIssues,
  details,
  outcomes,
  costs,
  highFindings,
  medFindings,
  lowFindings,
}) {
  if (!metrics) return <p className="text-xs sm:text-sm text-slate-500">Metrics unavailable.</p>;

  return (
    <>
      <OutcomeHeroRow metrics={metrics} outcomes={outcomes} costs={costs} />

      {outcomes?.messagesPerDay && outcomes.messagesPerDay.length > 0 && (
        <MessagesPerDayCard rows={outcomes.messagesPerDay} />
      )}

      <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2">
        {outcomes?.composeHealth && <ComposeHealthCard health={outcomes.composeHealth} />}
        {outcomes?.connectionHealth && <ConnectionHealthCard health={outcomes.connectionHealth} activity={outcomes.activity} />}
      </div>

      <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2">
        {outcomes?.modelBreakdown && <ModelBreakdownCard rows={outcomes.modelBreakdown} />}
        {outcomes?.topBoundaries && <TopBoundariesCard rows={outcomes.topBoundaries} />}
      </div>

      {outcomes?.growth && (
        <GrowthCard growth={outcomes.growth} activity={outcomes.activity} />
      )}

      {/* Severity lanes for findings still live on the overview — they're
          the signal that something NEEDS a response, next to the dashboard
          that shows whether the product is doing its job. */}
      {(highFindings.length > 0 || medFindings.length > 0 || lowFindings.length > 0) && (
        <section className="mt-6 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Findings</h2>
          {highFindings.length > 0 && (
            <SeverityLane title="Act now" count={highFindings.length} color="red" defaultOpen>
              {highFindings.map((f, i) => <FindingCard key={`${f.code}-${i}`} finding={f} />)}
            </SeverityLane>
          )}
          {medFindings.length > 0 && (
            <SeverityLane title="Worth a look" count={medFindings.length} color="amber" defaultOpen={highFindings.length === 0}>
              {medFindings.map((f, i) => <FindingCard key={`${f.code}-${i}`} finding={f} />)}
            </SeverityLane>
          )}
          {lowFindings.length > 0 && (
            <SeverityLane title="Notes" count={lowFindings.length} color="slate">
              {lowFindings.map((f, i) => <FindingCard key={`${f.code}-${i}`} finding={f} />)}
            </SeverityLane>
          )}
        </section>
      )}

      {userIssues && (userIssues.heldPerUser?.length > 0 || userIssues.draftsPerUser?.length > 0) && (
        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Per-user issues (7 days)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {userIssues.heldPerUser?.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-700 mb-2">Most held messages</p>
                {userIssues.heldPerUser.map((u, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 truncate">{u.name}</span>
                    <span className="font-semibold text-red-600">{u.count}</span>
                  </div>
                ))}
              </div>
            )}
            {userIssues.draftsPerUser?.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-700 mb-2">Most unsent drafts</p>
                {userIssues.draftsPerUser.map((u, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 truncate">{u.name}</span>
                    <span className="font-semibold text-amber-600">{u.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

// ─── Overview panels ────────────────────────────────────────────────────────

const pct = (n) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);
const num = (n) => (n === null || n === undefined ? "—" : n.toLocaleString());

/**
 * Four big product numbers at the top of the overview. Chosen for what a
 * product owner would read first on a Monday morning: who is using it,
 * whether it is working for them, and what it costs to keep running.
 */
function OutcomeHeroRow({ metrics, outcomes, costs }) {
  const act = outcomes?.activity;
  const compose = outcomes?.composeHealth;
  const last30 = costs?.last30d;
  const costPerUser =
    last30 && act?.mau > 0 ? last30.totalUsd / act.mau : null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
      <HeroStat
        label="Weekly active"
        value={num(act?.wau ?? null)}
        hint={act?.mau ? `${pct((act?.wau ?? 0) / Math.max(1, act.mau))} of 30d actives` : null}
      />
      <HeroStat
        label="Send-through"
        value={pct(compose?.sendThroughRate)}
        hint={compose ? `${num(compose.composed)} composed · ${num(compose.sent)} sent (7d)` : null}
        tone={compose && compose.sendThroughRate !== null && compose.sendThroughRate < 0.7 ? "amber" : "default"}
      />
      <HeroStat
        label="AI approval"
        value={pct(compose?.approvalRate)}
        hint={compose ? `${pct(compose.rawSendRate)} sent raw` : null}
        tone={compose && compose.approvalRate !== null && compose.approvalRate < 0.8 ? "amber" : "default"}
      />
      <HeroStat
        label="Monthly spend"
        value={last30 ? `$${last30.totalUsd.toFixed(2)}` : "—"}
        hint={costPerUser !== null ? `~$${costPerUser.toFixed(3)}/active user` : null}
      />
    </div>
  );
}

function HeroStat({ label, value, hint, tone }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : tone === "red"
        ? "border-red-200 bg-red-50"
        : "border-slate-100 bg-white";
  return (
    <div className={`rounded-xl border ${toneClass} p-3 sm:p-4 shadow-sm`}>
      <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] sm:text-xs text-slate-500 truncate">{hint}</p>}
    </div>
  );
}

/**
 * A stacked bar per day: sent (green), held (red), draft (amber).
 *
 * Rendered as plain CSS width percentages rather than a charting library.
 * The point is "did yesterday look like the day before"; a precise axis
 * would not help make that call faster, and a library would ship kilobytes
 * to render ten columns.
 */
function MessagesPerDayCard({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.sent + r.held + r.draft));
  return (
    <section className="mt-4 sm:mt-6 rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-2 sm:mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Messages per day (14d)</h3>
        <div className="flex gap-3 text-[10px] text-slate-500">
          <LegendDot color="bg-emerald-500" label="sent" />
          <LegendDot color="bg-red-400" label="held" />
          <LegendDot color="bg-amber-400" label="draft" />
        </div>
      </div>
      <div className="flex items-end gap-1 sm:gap-1.5 h-32 sm:h-40 overflow-x-auto">
        {rows.map((r) => {
          const total = r.sent + r.held + r.draft;
          const height = total === 0 ? 0 : (total / max) * 100;
          return (
            <div
              key={r.day}
              className="flex-1 min-w-[22px] flex flex-col items-center gap-1 group"
              title={`${r.day}: ${r.sent} sent, ${r.held} held, ${r.draft} draft`}
            >
              <div className="w-full flex-1 flex flex-col-reverse justify-end relative" style={{ height: `${height}%`, minHeight: total > 0 ? 4 : 0 }}>
                {r.sent > 0 && <div className="bg-emerald-500" style={{ flexBasis: `${(r.sent / total) * 100}%` }} />}
                {r.held > 0 && <div className="bg-red-400" style={{ flexBasis: `${(r.held / total) * 100}%` }} />}
                {r.draft > 0 && <div className="bg-amber-400" style={{ flexBasis: `${(r.draft / total) * 100}%` }} />}
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 whitespace-nowrap">
                {r.day.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}

function ComposeHealthCard({ health }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-700 mb-2">AI compose health (7d)</p>
      <Row label="Composed" value={num(health.composed)} />
      <Row label="Sent" value={num(health.sent)} />
      <Row label="Held by boundary" value={num(health.held)} />
      <Row label="Draft (awaiting sender)" value={num(health.draftWaiting)} />
      <Row label="Approval rate" value={pct(health.approvalRate)} emphasize />
      <Row label="Raw-send rate" value={pct(health.rawSendRate)} />
    </div>
  );
}

function ConnectionHealthCard({ health, activity }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-700 mb-2">Connection activity (7d)</p>
      <Row label="Active pairs" value={num(health.activeConnections)} />
      <Row label="Of total" value={activity ? `${num(health.activeConnections)} / ${num(activity.activeConnections)}` : "—"} />
      <Row label="Median messages / pair" value={num(health.medianMessages)} emphasize />
      <Row label="Top-10% pair sent" value={num(health.topTenth)} />
      <Row label="Stickiness (DAU/MAU)" value={pct(activity?.stickiness)} />
    </div>
  );
}

function ModelBreakdownCard({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-700">AI models (7d)</p>
        <p className="mt-2 text-xs text-slate-500">No AI calls in the window.</p>
      </div>
    );
  }
  const total = rows.reduce((n, r) => n + r.total, 0);
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-700 mb-2">AI models (7d)</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 text-[10px] uppercase">
            <th className="text-left font-medium pb-1">Model</th>
            <th className="text-right font-medium pb-1">Share</th>
            <th className="text-right font-medium pb-1">Sent</th>
            <th className="text-right font-medium pb-1">Held</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model} className="border-t border-slate-50">
              <td className="py-1 text-slate-700 truncate max-w-[12rem]">{r.model}</td>
              <td className="py-1 text-right text-slate-500">{pct(r.total / total)}</td>
              <td className="py-1 text-right text-emerald-600">{num(r.sent)}</td>
              <td className="py-1 text-right text-red-500">{num(r.held)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopBoundariesCard({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-700">Top boundaries</p>
        <p className="mt-2 text-xs text-slate-500">No boundaries set by anyone yet.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-700 mb-2">Top boundaries across users</p>
      <div className="space-y-1">
        {rows.slice(0, 8).map((r) => (
          <div key={`${r.topic}-${r.level}`} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${r.level === "red" ? "bg-red-500" : "bg-amber-400"}`} />
              <span className="text-slate-700 truncate">{r.topic}</span>
            </span>
            <span className="text-slate-500 shrink-0 font-medium">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthCard({ growth }) {
  if ((growth.newUsers.length + growth.newConnections.length) === 0) return null;
  const weeks = [...new Set([
    ...growth.newUsers.map((r) => r.week),
    ...growth.newConnections.map((r) => r.week),
  ])].sort();
  const userMap = Object.fromEntries(growth.newUsers.map((r) => [r.week, r.count]));
  const connMap = Object.fromEntries(growth.newConnections.map((r) => [r.week, r.count]));
  const max = Math.max(1, ...weeks.map((w) => (userMap[w] || 0) + (connMap[w] || 0)));

  return (
    <section className="mt-4 sm:mt-6 rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-2 sm:mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Growth (last 4 weeks)</h3>
        <div className="flex gap-3 text-[10px] text-slate-500">
          <LegendDot color="bg-emerald-500" label="new users" />
          <LegendDot color="bg-blue-400" label="new connections" />
        </div>
      </div>
      <div className="flex items-end gap-3 h-28">
        {weeks.map((w) => {
          const u = userMap[w] || 0;
          const c = connMap[w] || 0;
          return (
            <div key={w} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                <div className="w-3 sm:w-5 bg-emerald-500 rounded-t" style={{ height: `${(u / max) * 100}%`, minHeight: u > 0 ? 3 : 0 }} title={`${u} new users`} />
                <div className="w-3 sm:w-5 bg-blue-400 rounded-t" style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? 3 : 0 }} title={`${c} new connections`} />
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">{w.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Row({ label, value, emphasize = false }) {
  return (
    <div className="flex justify-between text-xs py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={emphasize ? "font-semibold text-slate-900" : "text-slate-700"}>{value}</span>
    </div>
  );
}


function FindingCard({ finding: f }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border p-3 ${SEVERITY_STYLE[f.severity]}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-sm">
            {f.title}{f.subject ? <span className="font-normal"> · {f.subject}</span> : ""}
          </p>
          <svg className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 text-sm space-y-1">
          <p>{f.detail}</p>
          {f.remediation && <p className="opacity-80"><strong>Fix:</strong> {f.remediation}</p>}
          {f.evidence && (
            <div className="mt-1 text-xs opacity-70">
              {Object.entries(f.evidence).map(([k, v]) => (
                <span key={k} className="mr-3">{k}: <strong>{v}</strong></span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Calls Tab ───────────────────────────────────────────────────────────

function formatUsd(n) {
  if (n == null || isNaN(n)) return "$0.00";
  if (n < 0.01 && n > 0) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

function CostPanel({ costs }) {
  if (!costs) return null;

  const windows = [
    { key: "last24h", label: "24 hours" },
    { key: "last7d", label: "7 days" },
    { key: "last30d", label: "30 days" },
  ];

  const primary = costs.last30d || costs.last7d || costs.last24h;
  const hasUnknown = primary?.unknownModels?.length > 0;

  return (
    <section className="space-y-3">
      <h3 className="text-sm sm:text-base font-semibold text-slate-900">Estimated Cost</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {windows.map(({ key, label }) => {
          const w = costs[key];
          if (!w) return null;
          return (
            <div key={key} className="rounded-xl border border-slate-100 bg-white shadow-sm p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900">{formatUsd(w.totalUsd)}</p>
              <div className="mt-1 space-y-0.5 text-[10px] sm:text-xs text-slate-500">
                <p>{w.totalCalls} calls · {w.totalTokens.toLocaleString()} tokens</p>
                <p>{w.userCount} user{w.userCount !== 1 ? "s" : ""} · {formatUsd(w.usdPerUser)}/user</p>
                {w.projectedMonthlyUsd != null && key !== "last30d" && (
                  <p className="text-emerald-600 font-medium">~{formatUsd(w.projectedMonthlyUsd)}/mo projected</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Projected monthly from the 30d window */}
      {costs.last30d && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-emerald-800">Monthly projection</p>
              <p className="text-[10px] sm:text-xs text-emerald-600 mt-0.5">
                Based on the last 30 days · {costs.activeUsers30d} active user{costs.activeUsers30d !== 1 ? "s" : ""}
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-emerald-800">
              {formatUsd(costs.last30d.projectedMonthlyUsd)}
            </p>
          </div>
        </div>
      )}

      {/* Per-model breakdown */}
      {primary?.byModel?.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <p className="px-3 sm:px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">By model</p>
          <div className="divide-y divide-slate-50">
            {primary.byModel.map((m) => (
              <div key={m.model} className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{m.model}</p>
                  <p className="text-[10px] sm:text-xs text-slate-400">{m.calls} calls · {m.tokens.toLocaleString()} tokens</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900">{formatUsd(m.usd)}</p>
                  {!m.rateKnown && (
                    <p className="text-[10px] text-amber-600">est.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staleness + unknown model warnings */}
      <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs text-slate-400">
        {primary?.ratesVerifiedOn && (
          <span>Rates as of {primary.ratesVerifiedOn}</span>
        )}
        {primary?.assumedOutputShare != null && (
          <span>· {Math.round(primary.assumedOutputShare * 100)}% output share assumed</span>
        )}
      </div>
      {hasUnknown && (
        <p className="text-[10px] sm:text-xs text-amber-600">
          ⚠ Fallback rate used for: {primary.unknownModels.join(", ")}
        </p>
      )}
    </section>
  );
}

function AICallsTab({ details, metrics, costs }) {
  const aiCalls = details?.aiCalls || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Cost estimation panel */}
      <CostPanel costs={costs} />

      {metrics?.aiPipeline && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
          <StatCard label="Succeeded (24h)" value={metrics.aiPipeline.succeeded24h} hint="delivered" />
          <StatCard label="Failed (24h)" value={metrics.aiPipeline.failed24h} hint="ai_failed" />
          <StatCard label="Refused (24h)" value={metrics.aiPipeline.refused24h} hint="content policy" />
          <StatCard label="Success Rate"
            value={metrics.aiPipeline.successRate !== null ? `${metrics.aiPipeline.successRate}%` : "—"}
            hint="24h window" />
        </div>
      )}

      {metrics?.aiPipeline?.byProvider?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {metrics.aiPipeline.byProvider.map((p) => (
            <span key={p.provider} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-emerald-700">
              {p.provider}: {p.count}
            </span>
          ))}
        </div>
      )}

      {metrics?.heldReasons?.length > 0 && (
        <div>
          <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Held reasons (all time)</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {metrics.heldReasons.map((r) => (
              <span key={r.reason} className="rounded-full bg-amber-50 border border-amber-200 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-amber-700">
                {r.reason}: {r.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">Recent AI Calls (24h)</h3>
        {aiCalls.length === 0 ? (
          <p className="text-xs sm:text-sm text-slate-500">No AI calls in the last 24 hours.</p>
        ) : (
          <>
            {/* Card layout on mobile, table on larger screens */}
            <div className="sm:hidden space-y-2">
              {aiCalls.map((call) => (
                <div key={call.id} className="rounded-xl border border-slate-100 bg-white shadow-sm p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate">{call.sender}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${AI_STATUS_STYLE[call.status] || "bg-slate-100 text-slate-600"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${call.status === "sent" ? "bg-emerald-500" : call.status === "held" ? "bg-red-500" : "bg-amber-500"}`} />
                      {call.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{new Date(call.createdAt).toLocaleTimeString()}</span>
                    {call.provider && <span className="rounded bg-emerald-50 px-1 text-emerald-600">{call.provider}</span>}
                    {call.model && <span className="font-mono truncate">{call.model}</span>}
                    {call.tokens != null && <span>{call.tokens} tok</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Table on sm+ */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Sender</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Tokens</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aiCalls.map((call) => (
                    <tr key={call.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(call.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 truncate max-w-[120px]">{call.sender}</td>
                      <td className="px-4 py-2.5">
                        {call.provider
                          ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{call.provider}</span>
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{call.model || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{call.tokens ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${AI_STATUS_STYLE[call.status] || "bg-slate-100 text-slate-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${call.status === "sent" ? "bg-emerald-500" : call.status === "held" ? "bg-red-500" : "bg-amber-500"}`} />
                          {call.status}{call.heldReason && call.heldReason !== call.status ? ` (${call.heldReason})` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Error Logs Tab ─────────────────────────────────────────────────────────

function LogsTab({ logs, unresolvedCount, resolvedCount, showResolved, setShowResolved, resolveLog }) {
  return (
    <>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">Error Log</h3>
          <p className="text-xs sm:text-sm text-slate-500">
            {unresolvedCount} active{resolvedCount > 0 ? ` · ${resolvedCount} resolved` : ""}
          </p>
        </div>
        {resolvedCount > 0 && (
          <button onClick={() => setShowResolved(!showResolved)}
            className="text-[10px] sm:text-xs font-medium text-emerald-600 hover:text-emerald-800">
            {showResolved ? "Hide resolved" : `Show (${resolvedCount})`}
          </button>
        )}
      </div>

      {(!logs || logs.length === 0) && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-6 text-center">
          <p className="text-sm font-medium text-emerald-700">
            {unresolvedCount === 0 ? "No active errors" : "Nothing logged."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {logs?.map((l) => (
          <div key={l.id} className={`rounded-xl border bg-white p-3 sm:p-4 shadow-sm transition-opacity ${l.resolved ? "border-slate-50 opacity-50" : "border-slate-100"}`}>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase ${LEVEL_STYLE[l.level] || "bg-slate-100 text-slate-600"}`}>
                {l.level}
              </span>
              <span className="font-mono text-[10px] sm:text-xs text-slate-500 truncate">{l.source}</span>
              <span className="ml-auto text-[10px] sm:text-xs text-slate-400 shrink-0">×{l.count}</span>
            </div>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium text-slate-800">{l.message}</p>
            {l.detail && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-[10px] sm:text-xs text-slate-600 max-h-32 overflow-y-auto">{l.detail}</pre>
            )}
            {l.resolved ? (
              <p className="mt-2 text-[10px] sm:text-xs text-emerald-600 font-medium">Resolved</p>
            ) : (
              <button onClick={() => resolveLog(l.id)} className="mt-2 text-[10px] sm:text-xs font-medium text-emerald-600 hover:text-emerald-800">
                Mark resolved
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Data Lens Tab ──────────────────────────────────────────────────────────

function DataLensTab() {
  const [catalog, setCatalog] = useState(null);
  // Which mode the operator is using: "ask" (AI writes a query), "peek"
  // (table sample), "sql" (hand-written). Kept as one state because each
  // produces the same kind of result — a SQL string and a row table —
  // and the mode picker is a tab, not a navigation.
  const [mode, setMode] = useState("ask");

  // Shared across modes: the generated/typed SQL, the result, a loading
  // flag. Reset on mode change so a stale table from Ask does not sit
  // under a Peek header.
  const [generatedSql, setGeneratedSql] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState(null);

  // Ask mode: question + agent (provider name).
  const [question, setQuestion] = useState("");
  const [agent, setAgent] = useState(null);

  // Peek mode: which table the operator is looking at.
  const [peekTable, setPeekTable] = useState(null);

  // SQL mode: an editable textarea seeded from the last generated SQL,
  // so the operator can inspect the AI's query and tweak it.
  const [sqlDraft, setSqlDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/query");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setCatalog(data);
        const firstAgent = data.agents?.[0]?.name || null;
        setAgent(firstAgent);
      } catch { /* leave null; the error renders below */ }
    })();
    return () => { cancelled = true; };
  }, []);

  function changeMode(next) {
    setMode(next);
    setResult(null);
    setGeneratedSql("");
    setExplanation(null);
  }

  async function post(body) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, reason: data.reason || `Request failed (${res.status})`, ...data });
      } else {
        setResult(data);
      }
      if (data.generatedSql) setGeneratedSql(data.generatedSql);
      if (data.explanation !== undefined) setExplanation(data.explanation);
    } catch {
      setResult({ ok: false, reason: "Network error" });
    }
    setLoading(false);
  }

  async function runAsk() {
    if (!question.trim() || !agent) return;
    await post({ ask: question.trim(), agent });
  }

  async function runPeek(table) {
    setPeekTable(table);
    await post({ peek: table });
  }

  async function runSql() {
    if (!sqlDraft.trim()) return;
    await post({ sql: sqlDraft.trim() });
  }

  return (
    <>
      <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm mb-4 sm:mb-6">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900">Data Lens</h3>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Read-only queries. Sensitive columns (message bodies, free-text status, auth secrets) are never returned.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-4 flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { key: "ask", label: "Ask", hint: "AI writes a query" },
          { key: "peek", label: "Peek", hint: "Sample a table" },
          { key: "sql", label: "SQL", hint: "Write it yourself" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => changeMode(m.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm transition-colors ${
              mode === m.key ? "bg-white shadow-sm font-medium text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="block">{m.label}</span>
            <span className="block text-[10px] text-slate-400 font-normal">{m.hint}</span>
          </button>
        ))}
      </div>

      {mode === "ask" && (
        <AskMode
          catalog={catalog}
          question={question}
          setQuestion={setQuestion}
          agent={agent}
          setAgent={setAgent}
          loading={loading}
          onRun={runAsk}
        />
      )}

      {mode === "peek" && (
        <PeekMode
          catalog={catalog}
          onPeek={runPeek}
          active={peekTable}
          loading={loading}
        />
      )}

      {mode === "sql" && (
        <SqlMode
          draft={sqlDraft}
          setDraft={setSqlDraft}
          seededFrom={generatedSql}
          onRun={runSql}
          loading={loading}
        />
      )}

      {/* The query that actually ran — shown for ALL three modes because in
          Ask mode you want to read what the AI wrote, in Peek you want to
          see the exact columns selected, and in SQL you want to confirm
          what was sent. */}
      {(generatedSql || loading) && (
        <div className="mt-4 sm:mt-6 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 sm:px-4 py-2">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-400">
              {mode === "ask" ? "AI-generated SQL" : mode === "peek" ? "Peek SQL" : "SQL that ran"}
            </p>
            {result?.durationMs !== undefined && (
              <span className="text-[10px] text-slate-400 shrink-0">
                {result.rowCount ?? result.rows?.length ?? 0} row(s) · {result.durationMs}ms
              </span>
            )}
          </div>
          {explanation && (
            <p className="px-3 sm:px-4 pt-2 text-[11px] sm:text-xs text-slate-500 italic">
              {explanation}
            </p>
          )}
          <pre className="px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-mono leading-relaxed text-slate-700 whitespace-pre-wrap overflow-x-auto max-h-56 overflow-y-auto">
{generatedSql || "— running —"}
          </pre>
          {mode === "ask" && generatedSql && (
            <div className="px-3 sm:px-4 pb-2 sm:pb-3">
              <button
                onClick={() => { setSqlDraft(generatedSql); changeMode("sql"); setSqlDraft(generatedSql); }}
                className="text-[11px] font-medium text-emerald-600 hover:underline"
              >
                Edit in SQL mode →
              </button>
            </div>
          )}
        </div>
      )}

      <ResultPane result={result} loading={loading} />
    </>
  );
}

function AskMode({ catalog, question, setQuestion, agent, setAgent, loading, onRun }) {
  const agents = catalog?.agents || [];
  const samples = catalog?.sampleQuestions || [];

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm space-y-3">
      <div>
        <p className="text-xs font-medium text-slate-700">Agent</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {agents.length === 0 && (
            <p className="text-[11px] text-amber-700">No provider configured — add an API key.</p>
          )}
          {agents.map((a) => (
            <button
              key={a.name}
              onClick={() => setAgent(a.name)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                agent === a.name
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-gray-200"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Your question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How many messages were held each day over the last two weeks?"
          rows={2}
          maxLength={500}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={onRun}
            disabled={loading || !question.trim() || !agent}
            className="bg-emerald-600 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-emerald-700"
          >
            {loading ? "Thinking…" : "Generate & run"}
          </button>
          <p className="text-[10px] text-slate-400">
            The AI writes the SQL; a human-reviewed allow-list runs it read-only.
          </p>
        </div>
      </div>

      {samples.length > 0 && (
        <div>
          <p className="text-[10px] uppercase text-slate-400 mb-1.5">Sample questions</p>
          <div className="space-y-0.5">
            {samples.map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="block w-full text-left text-[11px] text-emerald-700 hover:underline"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeekMode({ catalog, onPeek, active, loading }) {
  const tables = catalog?.tables || [];

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-700 mb-2">Pick a table — latest 10 rows, safe columns only</p>
      <div className="flex flex-wrap gap-1.5">
        {tables.map((t) => (
          <button
            key={t.name}
            onClick={() => onPeek(t.name)}
            disabled={loading}
            title={
              t.sensitiveColumns.length > 0
                ? `Hidden: ${t.sensitiveColumns.join(", ")}`
                : "No sensitive columns on this table"
            }
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              active === t.name
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-white text-slate-600 hover:bg-slate-50"
            } disabled:opacity-50`}
          >
            {t.name}
            {t.sensitiveColumns.length > 0 && (
              <span className="ml-1 text-[10px] text-slate-400">
                ({t.sensitiveColumns.length} hidden)
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function SqlMode({ draft, setDraft, seededFrom, onRun, loading }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm space-y-2">
      <label className="block text-xs font-medium text-slate-700">
        SELECT statement (read-only, one statement, 100-row cap)
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`SELECT "aiModel", count(*) FROM "Message" WHERE "createdAt" > now() - interval '7 days' GROUP BY "aiModel";`}
        rows={6}
        maxLength={4000}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[11px] sm:text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {seededFrom && draft === seededFrom && (
        <p className="text-[10px] text-slate-400">Seeded from the AI&rsquo;s last query.</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={onRun}
          disabled={loading || !draft.trim()}
          className="bg-emerald-600 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-emerald-700"
        >
          {loading ? "Running…" : "Run"}
        </button>
        <p className="text-[10px] text-slate-400">
          Rejected if it references a sensitive column, mutates, or exceeds the parser.
        </p>
      </div>
    </div>
  );
}

function ResultPane({ result, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-8 sm:py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }
  if (!result) return null;

  if (result.ok === false || result.reason) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-700 space-y-1">
        <p className="font-medium">Query rejected</p>
        <p>{result.reason}</p>
        {result.raw && (
          <pre className="mt-2 p-2 bg-red-100/50 rounded text-[10px] font-mono whitespace-pre-wrap">
            {result.raw}
          </pre>
        )}
      </div>
    );
  }

  if (!result.rows) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
          {result.table ? `Peek · ${result.table}` : "Results"}
        </p>
        <span className="text-[10px] sm:text-xs text-slate-400 shrink-0">
          {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
          {result.truncated ? " (capped)" : ""}
        </span>
      </div>
      <div className="overflow-x-auto max-h-[400px] sm:max-h-[500px] overflow-y-auto">
        {result.rows.length === 0 ? (
          <p className="px-3 sm:px-4 py-6 sm:py-8 text-xs sm:text-sm text-slate-500 text-center">No rows returned.</p>
        ) : (
          <DataTable rows={result.rows} />
        )}
      </div>
    </div>
  );
}


// Derived explanation columns carry sentences. Truncating them to the same
// width as an id is what made the reason unreadable in the first place.
const WIDE_COLUMNS = new Set(["why", "whatToDo", "reason", "contentRaw", "action", "detail", "message"]);

function DataTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  const columns = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object" || rows[0][k] === null);
  const nested = Object.keys(rows[0]).filter((k) => typeof rows[0][k] === "object" && rows[0][k] !== null && !Array.isArray(rows[0][k]));

  const allCols = [...columns];
  for (const n of nested) {
    if (rows[0][n]) {
      for (const sub of Object.keys(rows[0][n])) {
        allCols.push(`${n}.${sub}`);
      }
    }
  }

  function cellValue(row, col) {
    if (col.includes(".")) {
      const [parent, child] = col.split(".");
      return row[parent]?.[child] ?? "";
    }
    const v = row[col];
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "yes" : "no";
    return String(v);
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100 sticky top-0 bg-white">
          {allCols.map((col) => (
            <th key={col} className="px-4 py-2 font-medium whitespace-nowrap">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className={`border-b border-slate-50 hover:bg-slate-50/50 ${
              row.needsAttention ? "bg-amber-50/40" : ""
            }`}
          >
            {allCols.map((col) => {
              const value = cellValue(row, col);
              const wide = WIDE_COLUMNS.has(col);
              return (
                <td
                  key={col}
                  title={wide ? value : undefined}
                  className={`px-4 py-2 align-top text-slate-700 ${
                    wide
                      ? "min-w-[14rem] max-w-[22rem] whitespace-pre-wrap text-xs"
                      : "max-w-[200px] truncate whitespace-nowrap"
                  }`}
                >
                  {value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Root Cause Tab ─────────────────────────────────────────────────────────

function RootCauseTab() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [agents, setAgents] = useState([]);
  // null = the failover chain. A named agent is asked alone, so a provider
  // that is misbehaving cannot be masked by the next one answering for it.
  const [agent, setAgent] = useState(null);
  // Also optional. Null = use that agent's default model; naming a model
  // asks the pinned agent to answer with that exact model, so the operator
  // can compare Opus against Haiku on the same prompt.
  const [modelId, setModelId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/root-cause");
        if (!cancelled && res.ok) setAgents((await res.json()).agents || []);
      } catch { /* the picker falls back to Auto */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const EXAMPLES = [
    "Why are messages getting held as drafts?",
    "Why is the AI provider failing?",
    "Are there any recurring errors I should worry about?",
    "Why are users not able to send messages?",
    "Is the email delivery system working?",
  ];

  async function ask(q) {
    const text = q || question;
    if (!text.trim()) return;
    setQuestion(text);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, agent, model: modelId }),
      });
      if (res.ok) setResult(await res.json());
      else {
        const body = await res.json().catch(() => ({}));
        setResult({ error: body.error || `Failed (${res.status})` });
      }
    } catch {
      setResult({ error: "Network error" });
    }
    setLoading(false);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm mb-4 sm:mb-6">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900">Root Cause</h3>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Ask why something is happening in production. The AI reads the monitoring data and logs.
        </p>
        <p className="mt-1 text-[10px] sm:text-xs text-slate-400">
          Read-only — it cannot change anything.
        </p>
      </div>

      {/* Agent picker */}
      <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm mb-4 sm:mb-6">
        <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Agent</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setAgent(null); setModelId(null); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              agent === null
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-600 border-gray-200"
            }`}
          >
            Auto (failover)
          </button>
          {agents.map((a) => (
            <button
              key={a.name}
              onClick={() => { setAgent(a.name); setModelId(null); }}
              title={a.model}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                agent === a.name
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-gray-200"
              }`}
            >
              {a.name}
              {!a.inChain && <span className="ml-1 opacity-60">(off-chain)</span>}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] sm:text-xs text-slate-400">
          {agent === null
            ? `Tries each configured provider in order${agents.length > 0 ? ` — ${agents.filter((a) => a.inChain).map((a) => a.name).join(" → ") || "none in the chain"}` : ""}.`
            : `Asks ${agent} only (${agents.find((a) => a.name === agent)?.model || "default model"}). No fallback, so a failure is reported rather than answered by another provider.`}
        </p>
        {agents.length === 0 && (
          <p className="mt-1 text-[10px] sm:text-xs text-amber-700">
            No provider is configured — add an API key before asking.
          </p>
        )}
        {agent && (() => {
          const current = agents.find((a) => a.name === agent);
          const models = current?.models || [];
          if (models.length === 0) return null;
          return (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-700 mb-1.5">Model</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setModelId(null)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    modelId === null
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-gray-200"
                  }`}
                  title={`Default: ${current.model}`}
                >
                  Default ({current.model.split("-").slice(-2).join(" ")})
                </button>
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModelId(m.id)}
                    title={m.notes || m.id}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      modelId === m.id
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-gray-200"
                    }`}
                  >
                    {m.label}
                    <span className="ml-1 text-[9px] opacity-60">
                      {m.tier === "deep" ? "deep" : m.tier === "fast" ? "fast" : ""}
                    </span>
                  </button>
                ))}
              </div>
              {modelId && (
                <p className="mt-1.5 text-[10px] text-slate-400">
                  {models.find((m) => m.id === modelId)?.notes}
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Question input */}
      <div className="rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm mb-4 sm:mb-6">
        <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Your question</p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why is there no AI activity in this environment?"
          rows={2}
          maxLength={1000}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="mt-2 sm:mt-3 flex items-center gap-3">
          <button
            onClick={() => ask()}
            disabled={loading || !question.trim()}
            className="bg-emerald-600 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-emerald-700"
          >
            {loading ? "Analyzing…" : "Ask"}
          </button>
          {loading && <div className="h-4 w-4 sm:h-5 sm:w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />}
        </div>
      </div>

      {/* Example questions */}
      {!result && !loading && (
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500 uppercase mb-2">Example questions</p>
          <div className="space-y-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => ask(ex)}
                className="block w-full text-left text-sm text-emerald-600 hover:text-emerald-800 py-1"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error === "ai_unavailable"
            ? (agent
                ? `${agent} did not answer. Try Auto, or another agent, to tell a provider outage from a wider one.`
                : "No AI provider available. Check your API keys.")
            : result.error === "agent_not_configured"
              ? `${agent} has no API key configured.`
              : result.error}
        </div>
      )}

      {result && !result.error && (
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {/* Cause headline */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="font-semibold text-slate-900">{result.cause || "Analysis"}</p>
            {result.confidence && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONFIDENCE_STYLE[result.confidence] || "bg-slate-100 text-slate-600"}`}>
                {result.confidence} confidence
              </span>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Answer */}
            {result.answer && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">What we know</p>
                <p className="text-sm text-slate-700">{result.answer}</p>
              </div>
            )}

            {/* Fix steps */}
            {result.fix?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Steps to fix</p>
                <ol className="space-y-1.5">
                  {result.fix.map((f, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div>
                        <span className="text-slate-800">{f.step}</span>
                        {f.where && <span className="ml-2 text-xs text-slate-400 font-mono">{f.where}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Verify */}
            {result.verify && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">How to verify</p>
                <p className="text-sm text-slate-700">{result.verify}</p>
              </div>
            )}

            {/* Meta */}
            {result.meta && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {result.meta.provider} · {result.meta.model} · {result.meta.tokens} tokens · {result.meta.durationMs}ms
                  {result.meta.pinned ? " · pinned agent" : " · via failover chain"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Written by an AI from the monitoring data and logs — verify before acting.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Infrastructure Tab ─────────────────────────────────────────────────────

function InfraTab({ findings }) {
  const configFindings = findings?.filter((f) =>
    ["missing_secret", "missing_base_url", "no_ai_provider", "single_ai_provider", "no_admin_email", "smtp_not_configured"].includes(f.code)
  ) || [];

  return (
    <>
      {configFindings.length > 0 ? (
        <section className="mb-6">
          <h3 className="text-base font-semibold text-slate-900 mb-3">Configuration</h3>
          <div className="space-y-2">
            {configFindings.map((f, i) => (
              <div key={`${f.code}-${i}`} className={`rounded-xl border p-4 ${SEVERITY_STYLE[f.severity]}`}>
                <p className="font-semibold text-sm">{f.title}{f.subject ? ` · ${f.subject}` : ""}</p>
                <p className="mt-1 text-sm">{f.detail}</p>
                {f.remediation && <p className="mt-1 text-sm opacity-80"><strong>Fix:</strong> {f.remediation}</p>}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 mb-6">
          <p className="text-sm font-medium text-emerald-700">All configuration checks pass.</p>
        </div>
      )}

      <EgressDiagnostic />
    </>
  );
}

function EgressDiagnostic() {
  const [state, setState] = useState({ kind: "idle" });

  async function run() {
    setState({ kind: "working" });
    try {
      const res = await fetch("/api/admin/diagnostics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ kind: "error", message: body.detail || `Failed (${res.status}).` });
        return;
      }
      setState({ kind: "ready", data: await res.json() });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Egress & Delivery</h3>
          <p className="mt-0.5 text-sm text-slate-500">SMTP probe — click to check.</p>
        </div>
        <button onClick={run} disabled={state.kind === "working"}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {state.kind === "working" ? "Probing…" : "Run diagnostic"}
        </button>
      </div>

      {state.kind === "error" && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.message}</p>
      )}
      {state.kind === "ready" && (
        <div className="mt-3 space-y-3">
          <div className={`rounded-xl border p-4 ${
            state.data.probes.some((p) => p.ok)
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            <p className="font-semibold">{state.data.summary}</p>
            <p className="mt-0.5 text-xs opacity-70">
              host {state.data.host} · {state.data.durationMs}ms · {state.data.node}
              {state.data.commitSha ? ` · ${state.data.commitSha.slice(0, 7)}` : ""}
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Port</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">ms</th>
                </tr>
              </thead>
              <tbody>
                {state.data.probes.map((p) => (
                  <tr key={`${p.address}:${p.port}`} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-xs">{p.address}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.port}</td>
                    <td className={`px-4 py-2 text-xs font-semibold ${p.ok ? "text-emerald-700" : "text-red-700"}`}>
                      {p.ok ? "OK" : p.code}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
