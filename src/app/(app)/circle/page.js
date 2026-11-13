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

function PersonCard({ person, onDisconnect }) {
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const name = person.displayName || (person.username ? `@${person.username}` : "Your person");
  const moodStyle = MOOD_STYLES[person.statusMood] || MOOD_STYLES.neutral;
  const bs = person.boundarySummary || { red: 0, yellow: 0, green: 0 };
  const boundaries = person.boundaries || [];

  async function handleDisconnect() {
    setDisconnecting(true);
    await onDisconnect(person.connectionId);
    setDisconnecting(false);
    setConfirmingDisconnect(false);
    setShowBoundaries(false);
  }

  return (
    <>
      <div
        onClick={() => setShowBoundaries(true)}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer active:bg-slate-50 transition-colors"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{name}</h2>
              {person.username && person.displayName && (
                <p className="text-sm text-slate-500">@{person.username}</p>
              )}
            </div>
            <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Prefers:</span>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {TONE_LABELS[person.tonePreference] || "Warm & gentle"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {bs.red > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-red-700 font-medium">{bs.red}</span>
                </span>
              )}
              {bs.yellow > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-amber-700 font-medium">{bs.yellow}</span>
                </span>
              )}
              {bs.green > 0 && (
                <span className="flex items-center gap-0.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-700 font-medium">{bs.green}</span>
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">Tap to see {name}&apos;s boundaries</p>
        </div>

        <div className="flex border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
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
            className="flex-1 text-center text-slate-600 py-2.5 hover:bg-slate-50 transition-colors"
          >
            <span className="text-xs font-medium block">AI Tuning</span>
            <span className="text-[9px] text-slate-400">Adjust tone &amp; topics</span>
          </Link>
        </div>
      </div>

      {/* Boundary popup */}
      {showBoundaries && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowBoundaries(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl flex flex-col animate-[slideUp_0.2s_ease-out]"
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">{name}&apos;s Boundaries</h3>
              <button onClick={() => setShowBoundaries(false)} className="text-slate-400 text-lg p-1" aria-label="Close">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <p className="text-xs text-slate-500">These are the topics {name} has set preferences for. The AI will warn you if your message touches a sensitive topic.</p>

              {boundaries.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4 text-center">No boundaries set yet</p>
              ) : (
                <div className="space-y-3">
                  {boundaries.filter((b) => b.comfortLevel === "red").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase mb-1.5">Avoids</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boundaries.filter((b) => b.comfortLevel === "red").map((b) => (
                          <span key={b.topicName} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">{b.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {boundaries.filter((b) => b.comfortLevel === "yellow").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase mb-1.5">Gentle topics</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boundaries.filter((b) => b.comfortLevel === "yellow").map((b) => (
                          <span key={b.topicName} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">{b.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {boundaries.filter((b) => b.comfortLevel === "green").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 uppercase mb-1.5">Open to</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boundaries.filter((b) => b.comfortLevel === "green").map((b) => (
                          <span key={b.topicName} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">{b.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex gap-2">
                <Link
                  href={`/them?connectionId=${person.connectionId}`}
                  className="flex-1 text-center text-sm font-medium bg-emerald-600 text-white py-2.5 rounded-xl"
                >
                  View full profile
                </Link>
                <Link
                  href={`/chat/${person.connectionId}`}
                  className="flex-1 text-center text-sm font-medium border border-gray-200 text-slate-700 py-2.5 rounded-xl"
                >
                  Message
                </Link>
              </div>
              {confirmingDisconnect ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-red-700">Disconnect from {name}? This removes all messages and settings for this connection. Cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="flex-1 text-xs font-medium bg-red-600 text-white py-2 rounded-lg disabled:opacity-50"
                    >
                      {disconnecting ? "Disconnecting..." : "Yes, disconnect"}
                    </button>
                    <button
                      onClick={() => setConfirmingDisconnect(false)}
                      className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-600 py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDisconnect(true)}
                  className="w-full text-xs text-red-500 font-medium py-2 hover:bg-red-50 rounded-lg"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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

  const disconnect = (connectionId) =>
    act(`disconnect-${connectionId}`, () =>
      fetch("/api/circle/disconnect", {
        method: "POST",
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
            <PersonCard key={p.connectionId} person={p} onDisconnect={disconnect} />
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
