"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const MOOD_STYLES = {
  calm: { dot: "bg-blue-400", label: "Calm" },
  happy: { dot: "bg-emerald-400", label: "Happy" },
  energetic: { dot: "bg-orange-400", label: "Energetic" },
  low: { dot: "bg-slate-400", label: "Low" },
  neutral: { dot: "bg-violet-400", label: "Neutral" },
};

const TONE_LABELS = {
  warm_and_gentle: "Warm & gentle",
  direct_and_clear: "Direct & clear",
  playful_and_light: "Playful & light",
  calm_and_neutral: "Calm & neutral",
  encouraging_and_supportive: "Encouraging",
  brief_and_to_the_point: "Brief & direct",
  thoughtful_and_reflective: "Thoughtful",
  reassuring_and_patient: "Reassuring",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PersonCard({ person }) {
  const name = person.displayName || (person.username ? `@${person.username}` : "Your person");
  const moodStyle = MOOD_STYLES[person.statusMood] || MOOD_STYLES.neutral;
  const bs = person.boundarySummary || { red: 0, yellow: 0, green: 0 };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 space-y-4">
        {/* Name and status */}
        <div>
          <h2 className="text-lg font-bold text-slate-900">{name}</h2>
          {person.username && person.displayName && (
            <p className="text-sm text-slate-500">@{person.username}</p>
          )}
        </div>

        {person.statusText ? (
          <div className="flex items-start gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${moodStyle.dot} mt-1.5 shrink-0`} />
            <div>
              <p className="text-sm text-slate-700">{person.statusText}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {moodStyle.label} · {timeAgo(person.statusUpdatedAt)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No status right now</p>
        )}

        {/* Tone preference */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Prefers:</span>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {TONE_LABELS[person.tonePreference] || "Warm & gentle"}
          </span>
        </div>

        {/* Boundary summary */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Boundaries:</span>
          <div className="flex items-center gap-2">
            {bs.red > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-red-700 font-medium">{bs.red}</span>
              </span>
            )}
            {bs.yellow > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-amber-700 font-medium">{bs.yellow}</span>
              </span>
            )}
            {bs.green > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-medium">{bs.green}</span>
              </span>
            )}
            {bs.red === 0 && bs.yellow === 0 && bs.green === 0 && (
              <span className="text-xs text-slate-400">No boundaries set</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-gray-100">
        <Link
          href={`/chat/${person.connectionId}`}
          className="flex-1 text-center text-sm font-medium text-emerald-600 py-3 hover:bg-emerald-50 transition-colors"
        >
          Message
        </Link>
        <div className="w-px bg-gray-100" />
        <Link
          href={`/them?connectionId=${person.connectionId}`}
          className="flex-1 text-center text-sm font-medium text-slate-600 py-3 hover:bg-slate-50 transition-colors"
        >
          Profile
        </Link>
        <div className="w-px bg-gray-100" />
        <Link
          href={`/circle/settings?connectionId=${person.connectionId}`}
          className="flex-1 text-center text-sm font-medium text-slate-600 py-3 hover:bg-slate-50 transition-colors"
        >
          Guardian
        </Link>
      </div>
    </div>
  );
}

function PersonRow({ person, action }) {
  const name = person.displayName || (person.username ? `@${person.username}` : person.email || "Someone");
  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="min-w-0">
        <p className="font-semibold text-slate-800 truncate">{name}</p>
        {person.displayName && person.username && (
          <p className="text-sm text-slate-500 truncate">@{person.username}</p>
        )}
        {!person.displayName && !person.username && (
          <p className="text-sm text-slate-400 truncate">No username claimed yet</p>
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
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-emerald-700">
            Your handle: <span className="font-semibold">@{me.username}</span>
          </p>
          <p className="text-xs text-emerald-500 mt-0.5">Share it so people can find you.</p>
        </div>
        <button onClick={() => { setValue(me.username); setEditing(true); }} className="text-sm text-emerald-600 underline">
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
          className="bg-emerald-600 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
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
  const [error, setError] = useState(null);

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
    setError(null);
    try {
      const res = await fn();
      if (res && !res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || data.error || "Something went wrong. Please try again.");
        return;
      }
      await loadCircle();
      if (query.trim().length >= 2) {
        const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (searchRes.ok) setResults((await searchRes.json()).results);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
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
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
            Dismiss
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your Circle</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your people and how you relate to each of them.
        </p>
      </div>

      <UsernameCard me={me} onClaimed={(username) => setMe((m) => ({ ...m, username }))} />

      {/* Members as rich cards */}
      {circle.members.length > 0 && (
        <div className="space-y-4">
          {circle.members.map((p) => (
            <PersonCard key={p.connectionId} person={p} />
          ))}
        </div>
      )}

      {circle.members.length === 0 && circle.incoming.length === 0 && circle.outgoing.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center space-y-3">
          <p className="text-base text-emerald-800 font-medium">No one in your circle yet</p>
          <p className="text-sm text-emerald-600">
            Search below or invite someone to get started.
          </p>
        </div>
      )}

      {circle.incoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Wants to connect</h2>
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
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Waiting on them</h2>
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

      {/* Search / Invite */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Find someone</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by @username or name…"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Request
                </button>
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
