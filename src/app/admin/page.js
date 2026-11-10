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

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Gate({ title, children }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

// Pure: performs the request and reports the outcome, so it can be called from
// an effect without setting state synchronously.
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

export default function AdminPage() {
  const [state, setState] = useState({ status: "loading" });

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
    return () => {
      cancelled = true;
    };
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (state.status === "unconfigured") {
    return (
      <Gate title="Admin is not configured">
        <p>
          No administrators are set for this deployment. Add{" "}
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
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
        >
          Go to sign in
        </Link>
        <Link
          href="/admin/pin"
          className="mt-3 inline-block text-sm text-slate-500 hover:text-slate-700 hover:underline"
        >
          Email delivery broken? Use the admin PIN
        </Link>
      </Gate>
    );
  }

  if (state.status === "forbidden") {
    return (
      <Gate title="Not available">
        <p>This account does not have administrator access.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-indigo-600 underline">
          Back to Leeway
        </Link>
      </Gate>
    );
  }

  if (state.status === "error") {
    return (
      <Gate title="Something went wrong">
        <p>{state.message}</p>
        <button
          onClick={load}
          className="mt-4 rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </Gate>
    );
  }

  const { findings, metrics, logs, environment, generatedAt, viewer } = state.data;
  const worst = findings?.find((f) => f.severity === "high");

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leeway admin</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {environment}
            {viewer ? ` · ${viewer}` : ""} · generated{" "}
            {new Date(generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={load}
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
              hint={metrics.aiProviders.map((p) => p.name).join(" to ") || "none"}
            />
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">
          Findings {findings ? `(${findings.length})` : ""}
        </h2>
        {!findings && <p className="mt-2 text-sm text-red-600">Could not compute findings.</p>}
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
        {logs?.length === 0 && <p className="mt-2 text-sm text-slate-500">Nothing logged.</p>}
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
                <pre className="mt-1 overflow-x-auto wrap-break-word whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">
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
