"use client";

import { useCallback, useEffect, useState } from "react";

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

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// Read once during initialisation rather than setting state from an effect,
// which would trigger a cascading re-render. Guarded because sessionStorage is
// absent during server rendering and can throw in a private window.
function savedToken() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem("leeway_admin_token") || "";
  } catch {
    return "";
  }
}

// Pure: performs the request and reports the outcome. Holds no state, so it
// can be called from an effect without triggering a cascading render.
async function fetchOverview(t) {
  try {
    const res = await fetch("/api/admin/overview", {
      headers: { Authorization: `Bearer ${t}` },
    });

    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      return { error: body.detail || "Admin is not configured on this deployment." };
    }
    if (res.status === 401) return { error: "That token was not accepted." };
    if (!res.ok) return { error: `Request failed (${res.status}).` };

    return { data: await res.json() };
  } catch {
    return { error: "Could not reach the server." };
  }
}

function remember(t) {
  try {
    sessionStorage.setItem("leeway_admin_token", t);
  } catch {
    // Private window or blocked storage — the dashboard still works, the token
    // just isn't remembered for the next load.
  }
}

export default function AdminPage() {
  const [token, setToken] = useState(savedToken);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const apply = useCallback((result, t) => {
    if (result.error) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setData(result.data);
    setStatus("ready");
    remember(t);
  }, []);

  const load = useCallback(
    async (t) => {
      setStatus("loading");
      setError(null);
      apply(await fetchOverview(t), t);
    },
    [apply]
  );

  // Every state update happens after an await, never synchronously in the
  // effect body.
  useEffect(() => {
    const saved = savedToken();
    if (!saved) return;

    let cancelled = false;
    fetchOverview(saved).then((result) => {
      if (!cancelled) apply(result, saved);
    });

    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function resolveLog(id) {
    await fetch("/api/admin/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    load(token);
  }

  if (status !== "ready") {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
        <h1 className="text-2xl font-bold text-slate-900">Leeway admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the <code className="rounded bg-slate-100 px-1">ADMIN_TOKEN</code> set on
          this deployment.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            load(token);
          }}
        >
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            aria-label="Admin token"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={status === "loading" || !token}
            className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {status === "loading" ? "Checking…" : "Open dashboard"}
          </button>
        </form>
      </div>
    );
  }

  const { findings, metrics, logs, environment, generatedAt } = data;
  const worst = findings?.find((f) => f.severity === "high");

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leeway admin</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {environment} · generated {new Date(generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => load(token)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </header>

      <div
        className={`mt-6 rounded-xl border p-4 ${
          worst
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        <p className="font-semibold">
          {worst ? "Needs attention" : "No high-severity problems"}
        </p>
        <p className="mt-0.5 text-sm">
          {worst
            ? worst.detail
            : "Configuration looks complete and nothing critical was logged in the last 24 hours."}
        </p>
      </div>

      {metrics && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Users" value={metrics.users} />
            <Stat label="Connections" value={metrics.connections} />
            <Stat label="Sent" value={metrics.messagesSent} />
            <Stat label="Last 24h" value={metrics.messagesLast24h} />
            <Stat label="Held" value={metrics.messagesHeld} hint="red topic" />
            <Stat label="Drafts" value={metrics.messagesDraft} hint="unsent" />
            <Stat label="AI tokens" value={metrics.aiTokensTotal} hint="all time" />
            <Stat
              label="Providers"
              value={metrics.aiProviders.length}
              hint={metrics.aiProviders.map((p) => p.name).join(" → ") || "none"}
            />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Findings {findings ? `(${findings.length})` : ""}
        </h2>
        {!findings && (
          <p className="mt-2 text-sm text-red-600">Could not compute findings.</p>
        )}
        {findings?.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">Nothing to report.</p>
        )}
        <div className="mt-3 space-y-3">
          {findings?.map((f, i) => (
            <div
              key={`${f.code}-${f.subject ?? i}`}
              className={`rounded-xl border p-4 ${SEVERITY_STYLE[f.severity]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">
                  {f.title}
                  {f.subject && <span className="font-normal"> · {f.subject}</span>}
                </p>
                <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium uppercase">
                  {f.severity}
                </span>
              </div>
              <p className="mt-1 text-sm">{f.detail}</p>
              {f.remediation && (
                <p className="mt-2 text-sm opacity-80">
                  <strong>Fix:</strong> {f.remediation}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Error log</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Grouped by fingerprint — one row per distinct problem, with how often it
          occurred.
        </p>
        {!logs && <p className="mt-2 text-sm text-red-600">Could not read the log.</p>}
        {logs?.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">Nothing logged.</p>
        )}
        <div className="mt-3 space-y-2">
          {logs?.map((l) => (
            <div
              key={l.id}
              className={`rounded-xl border border-slate-100 bg-white p-4 shadow-sm ${
                l.resolved ? "opacity-50" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                    LEVEL_STYLE[l.level] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {l.level}
                </span>
                <span className="font-mono text-xs text-slate-500">{l.source}</span>
                <span className="ml-auto text-xs text-slate-400">
                  ×{l.count} · {new Date(l.lastSeenAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">{l.message}</p>
              {l.detail && (
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap wrap-break-word rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">
                  {l.detail}
                </pre>
              )}
              {!l.resolved && (
                <button
                  onClick={() => resolveLog(l.id)}
                  className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Mark resolved
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-slate-400">
        Findings are recomputed on every load, so they cannot go stale. A resolved entry
        reappears if the same problem happens again.
      </p>
    </div>
  );
}
