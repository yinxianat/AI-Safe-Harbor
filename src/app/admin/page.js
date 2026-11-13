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
        className={`w-full p-4 text-left ${hasDetail ? "cursor-pointer hover:bg-slate-50 transition-colors" : "cursor-default"}`}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          {hasDetail && (
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </button>
      {open && hasDetail && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 max-h-64 overflow-y-auto">
          {detail.map((row, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-sm border-b border-slate-50 last:border-0">
              <span className="flex-1 text-slate-700 truncate">{row.primary}</span>
              {row.secondary && <span className="shrink-0 text-xs text-slate-400">{row.secondary}</span>}
              {row.badge && (
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${row.badgeStyle || "bg-slate-100 text-slate-600"}`}>
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

  const { findings, metrics, logs, environment, generatedAt, viewer, userIssues, details } = state.data;
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
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {environment}{viewer ? ` · ${viewer}` : ""} · {new Date(generatedAt).toLocaleString()}
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </header>

      {/* Headline card */}
      <div className={`mt-5 rounded-xl border-l-4 border p-4 ${
        highFindings.length > 0
          ? "border-l-red-500 border-red-200 bg-red-50 text-red-800"
          : medFindings.length > 0
            ? "border-l-amber-400 border-amber-200 bg-amber-50 text-amber-800"
            : "border-l-emerald-500 border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}>
        <p className="font-semibold">{headlineText}</p>
        <p className="mt-0.5 text-sm">
          {highFindings.length > 0
            ? highFindings[0].detail
            : "Configuration looks complete and nothing critical was logged."}
        </p>
      </div>

      {/* Tab navigation */}
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === tab.key
                ? "bg-white border border-slate-200 border-b-white text-emerald-700 -mb-px"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {activeTab === "overview" && (
          <OverviewTab metrics={metrics} findings={findings} userIssues={userIssues} details={details}
            highFindings={highFindings} medFindings={medFindings} lowFindings={lowFindings} />
        )}
        {activeTab === "ai" && <AICallsTab details={details} metrics={metrics} />}
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

function OverviewTab({ metrics, userIssues, details, highFindings, medFindings, lowFindings }) {
  if (!metrics) return <p className="text-sm text-slate-500">Metrics unavailable.</p>;

  const userDetail = details?.users?.map((u) => ({
    primary: u.name, secondary: new Date(u.joined).toLocaleDateString(),
    badge: u.mood, badgeStyle: "bg-emerald-50 text-emerald-600",
  })) || [];

  const connDetail = details?.connections?.map((c) => ({
    primary: `${c.personA} ↔ ${c.personB}`, secondary: new Date(c.since).toLocaleDateString(),
  })) || [];

  const heldDetail = details?.heldMessages?.map((m) => ({
    primary: m.preview, secondary: m.sender,
    badge: m.heldReason || "held", badgeStyle: "bg-red-50 text-red-600",
  })) || [];

  const draftDetail = details?.draftMessages?.map((m) => ({
    primary: m.preview, secondary: m.sender,
    badge: m.heldReason || "draft", badgeStyle: "bg-amber-50 text-amber-600",
  })) || [];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Users" value={metrics.users} detail={userDetail} />
        <StatCard label="Connections" value={metrics.connections} detail={connDetail} />
        <StatCard label="Sent" value={metrics.messagesSent} />
        <StatCard label="Last 24h" value={metrics.messagesLast24h} />
        <StatCard label="Held" value={metrics.messagesHeld} hint="red topic" detail={heldDetail} />
        <StatCard label="Drafts" value={metrics.messagesDraft} hint="unsent" detail={draftDetail} />
        <StatCard label="AI Tokens" value={metrics.aiTokensTotal?.toLocaleString()} hint="all time" />
        <StatCard label="Providers" value={metrics.aiProviders.length}
          hint={metrics.aiProviders.map((p) => p.name).join(" → ") || "none"}
          detail={metrics.aiProviders.map((p) => ({ primary: p.name, badge: p.model, badgeStyle: "bg-emerald-50 text-emerald-600" }))}
        />
      </div>

      {/* Severity lanes for findings */}
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

function AICallsTab({ details, metrics }) {
  const aiCalls = details?.aiCalls || [];

  return (
    <>
      {metrics?.aiPipeline && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <StatCard label="Succeeded (24h)" value={metrics.aiPipeline.succeeded24h} hint="delivered" />
          <StatCard label="Failed (24h)" value={metrics.aiPipeline.failed24h} hint="ai_failed" />
          <StatCard label="Refused (24h)" value={metrics.aiPipeline.refused24h} hint="content policy" />
          <StatCard label="Success Rate"
            value={metrics.aiPipeline.successRate !== null ? `${metrics.aiPipeline.successRate}%` : "—"}
            hint="24h window" />
        </div>
      )}

      {metrics?.aiPipeline?.byProvider?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {metrics.aiPipeline.byProvider.map((p) => (
            <span key={p.provider} className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700">
              {p.provider}: {p.count} calls
            </span>
          ))}
        </div>
      )}

      {metrics?.heldReasons?.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-700 mb-2">Held reasons (all time)</p>
          <div className="flex flex-wrap gap-2">
            {metrics.heldReasons.map((r) => (
              <span key={r.reason} className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs text-amber-700">
                {r.reason}: {r.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-base font-semibold text-slate-900 mb-3">Recent AI Calls (24h)</h3>
      {aiCalls.length === 0 ? (
        <p className="text-sm text-slate-500">No AI calls in the last 24 hours.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
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
      )}
    </>
  );
}

// ─── Error Logs Tab ─────────────────────────────────────────────────────────

function LogsTab({ logs, unresolvedCount, resolvedCount, showResolved, setShowResolved, resolveLog }) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Error Log</h3>
          <p className="text-sm text-slate-500">
            {unresolvedCount} active{resolvedCount > 0 ? ` · ${resolvedCount} resolved` : ""}
          </p>
        </div>
        {resolvedCount > 0 && (
          <button onClick={() => setShowResolved(!showResolved)}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-800">
            {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
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
          <div key={l.id} className={`rounded-xl border bg-white p-4 shadow-sm transition-opacity ${l.resolved ? "border-slate-50 opacity-50" : "border-slate-100"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${LEVEL_STYLE[l.level] || "bg-slate-100 text-slate-600"}`}>
                {l.level}
              </span>
              <span className="font-mono text-xs text-slate-500">{l.source}</span>
              <span className="ml-auto text-xs text-slate-400">×{l.count} · {new Date(l.lastSeenAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-800">{l.message}</p>
            {l.detail && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">{l.detail}</pre>
            )}
            {l.resolved ? (
              <p className="mt-2 text-xs text-emerald-600 font-medium">Resolved</p>
            ) : (
              <button onClick={() => resolveLog(l.id)} className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-800">
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
  const [catalog, setCatalog] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/data-lens");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setCatalog(data.queries || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoadingCatalog(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function runQuery(key) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/data-lens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: key }),
      });
      if (res.ok) setResult(await res.json());
      else setResult({ error: `Query failed (${res.status})` });
    } catch {
      setResult({ error: "Network error" });
    }
    setLoading(false);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm mb-6">
        <h3 className="text-base font-semibold text-slate-900">Data Lens</h3>
        <p className="mt-1 text-sm text-slate-500">
          Read-only queries against the database. Every query runs in a transaction the database refuses writes in.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Left sidebar: query catalog */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Queries</p>
          {loadingCatalog && <p className="text-xs text-slate-400">Loading...</p>}
          {catalog.map((q) => (
            <button
              key={q.key}
              onClick={() => runQuery(q.key)}
              disabled={loading}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                result?.query === q.key
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-100 bg-white hover:bg-slate-50"
              } disabled:opacity-50`}
            >
              <p className="text-sm font-medium text-slate-900">{q.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{q.question}</p>
            </button>
          ))}
        </div>

        {/* Main area: results */}
        <div>
          {loading && (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            </div>
          )}
          {result?.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {result.error}
            </div>
          )}
          {result?.rows && !loading && (
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{result.title}</p>
                <span className="text-xs text-slate-400">
                  {result.count} row{result.count !== 1 ? "s" : ""} · {result.durationMs}ms
                </span>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                {result.rows.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-slate-500 text-center">No rows returned.</p>
                ) : (
                  <DataTable rows={result.rows} />
                )}
              </div>
            </div>
          )}
          {!result && !loading && (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              Select a query to run
            </div>
          )}
        </div>
      </div>
    </>
  );
}

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
          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
            {allCols.map((col) => (
              <td key={col} className="px-4 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                {cellValue(row, col)}
              </td>
            ))}
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
        body: JSON.stringify({ question: text }),
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
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm mb-6">
        <h3 className="text-base font-semibold text-slate-900">Root Cause</h3>
        <p className="mt-1 text-sm text-slate-500">
          Ask why something is happening in production. The AI reads the monitoring data, recent logs, and diagnostics, then says what to do about it.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Read-only — it cannot change anything.
        </p>
      </div>

      {/* Question input */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm mb-6">
        <p className="text-sm font-medium text-slate-700 mb-2">Your question</p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why is there no AI article in this environment at all?"
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => ask()}
            disabled={loading || !question.trim()}
            className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-emerald-700"
          >
            {loading ? "Analyzing..." : "Ask"}
          </button>
          {loading && <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />}
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
          {result.error === "ai_unavailable" ? "No AI provider available. Check your API keys." : result.error}
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
