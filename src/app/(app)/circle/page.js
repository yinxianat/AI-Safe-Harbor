"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

function PersonRow({ person, action }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="min-w-0">
        <p className="font-semibold text-slate-800 truncate">
          {person.displayName || `@${person.username}`}
        </p>
        {person.displayName && person.username && (
          <p className="text-sm text-slate-500 truncate">@{person.username}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function UsernameCard({ me, onClaimed }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Could not save that username.");
        return;
      }
      setEditing(false);
      onClaimed(data.username);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (me?.username && !editing) {
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-indigo-700">
            Your handle: <span className="font-semibold">@{me.username}</span>
          </p>
          <p className="text-xs text-indigo-500 mt-0.5">Share it so people can find you.</p>
        </div>
        <button onClick={() => { setValue(me.username); setEditing(true); }} className="text-sm text-indigo-600 underline">
          Change
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div>
        <p className="font-semibold text-slate-800">Claim your username</p>
        <p className="text-sm text-slate-500">
          This is how people find you — like a phone number you choose.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-gray-200 bg-white px-3">
          <span className="text-slate-400">@</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="yourname"
            className="w-full px-1 py-2 text-sm focus:outline-none"
            maxLength={20}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export default function CirclePage() {
  const [me, setMe] = useState(null);
  const [circle, setCircle] = useState({ members: [], incoming: [], outgoing: [] });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(null);

  const fetchCircle = useCallback(async () => {
    const res = await fetch("/api/circle");
    if (res.ok) return res.json();
    return null;
  }, []);

  const loadCircle = useCallback(async () => {
    const data = await fetchCircle();
    if (data) setCircle(data);
  }, [fetchCircle]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me").then(async (r) => {
      if (!cancelled && r.ok) setMe(await r.json());
    });
    fetchCircle().then((data) => {
      if (!cancelled && data) setCircle(data);
    });
    return () => { cancelled = true; };
  }, [fetchCircle]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Runs in the cleanup/next-tick path instead of synchronously
      const frame = requestAnimationFrame(() => setResults(null));
      return () => cancelAnimationFrame(frame);
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (!cancelled && res.ok) setResults((await res.json()).results);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  async function act(key, fn) {
    setBusy(key);
    try {
      await fn();
      await loadCircle();
      if (query.trim().length >= 2) {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) setResults((await res.json()).results);
      }
    } finally {
      setBusy(null);
    }
  }

  const sendRequest = (userId) =>
    act(`req-${userId}`, () =>
      fetch("/api/circle/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
    );

  const respond = (connectionId, action) =>
    act(`${action}-${connectionId}`, () =>
      fetch("/api/circle/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, action }),
      })
    );

  const cancel = (connectionId) =>
    act(`cancel-${connectionId}`, () =>
      fetch("/api/circle/request", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      })
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your Circle</h1>
        <p className="text-sm text-slate-500 mt-1">
          The people you share with. Find someone, send a request, connect.
        </p>
      </div>

      <UsernameCard me={me} onClaimed={(username) => setMe((m) => ({ ...m, username }))} />

      <div className="space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by @username or name…"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {searching && <p className="text-sm text-slate-400">Searching…</p>}
        {results && results.length === 0 && !searching && (
          <p className="text-sm text-slate-500">
            No one found. They may not have claimed a username yet —{" "}
            <Link href="/invite" className="underline">invite them by email</Link>.
          </p>
        )}
        {results?.map((r) => (
          <PersonRow
            key={r.id}
            person={r}
            action={
              r.status === "connected" ? (
                <span className="text-sm text-emerald-600 font-medium">In your circle</span>
              ) : r.status === "request_sent" ? (
                <span className="text-sm text-slate-400">Requested</span>
              ) : r.status === "request_received" ? (
                <button
                  onClick={() => respond(r.connectionId, "accept")}
                  disabled={busy !== null}
                  className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Accept
                </button>
              ) : (
                <button
                  onClick={() => sendRequest(r.id)}
                  disabled={busy !== null}
                  className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Request
                </button>
              )
            }
          />
        ))}
      </div>

      {circle.incoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Wants to connect with you</h2>
          {circle.incoming.map((p) => (
            <PersonRow
              key={p.connectionId}
              person={p}
              action={
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(p.connectionId, "accept")}
                    disabled={busy !== null}
                    className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(p.connectionId, "decline")}
                    disabled={busy !== null}
                    className="text-sm border border-gray-200 text-slate-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {circle.outgoing.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Waiting on them</h2>
          {circle.outgoing.map((p) => (
            <PersonRow
              key={p.connectionId}
              person={p}
              action={
                <button
                  onClick={() => cancel(p.connectionId)}
                  disabled={busy !== null}
                  className="text-sm text-slate-500 underline disabled:opacity-50"
                >
                  Cancel
                </button>
              }
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">In your circle</h2>
        {circle.members.length === 0 ? (
          <p className="text-sm text-slate-500">
            No one yet. Search above, or{" "}
            <Link href="/invite" className="underline">invite by email</Link> if they&apos;re not on
            Leeway.
          </p>
        ) : (
          circle.members.map((p) => (
            <PersonRow
              key={p.connectionId}
              person={p}
              action={
                <Link
                  href="/settings"
                  className="text-sm text-indigo-600 underline"
                >
                  Boundaries
                </Link>
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
