"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import Avatar from "@/components/Avatar.js";

const MOOD_DOTS = {
  calm: "bg-blue-400",
  happy: "bg-emerald-400",
  energetic: "bg-orange-400",
  low: "bg-slate-400",
  neutral: "bg-violet-400",
};

const TONE_SHORT_KEYS = {
  warm_and_gentle: "tone_warm_and_gentle_short",
  direct_and_clear: "tone_direct_and_clear",
  playful_and_light: "tone_playful_and_light",
  calm_and_neutral: "tone_calm_and_neutral",
  encouraging_and_supportive: "tone_encouraging_short",
  brief_and_to_the_point: "tone_brief_short",
  thoughtful_and_reflective: "tone_thoughtful_short",
  reassuring_and_patient: "tone_reassuring_short",
};

function useTimeAgo() {
  const { t } = useT();
  return (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("circle_time_just_now");
    if (mins < 60) return t("circle_time_minutes", { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("circle_time_hours", { n: hrs });
    return t("circle_time_days", { n: Math.floor(hrs / 24) });
  };
}

function PersonCard({ person, onDisconnect }) {
  const { t } = useT();
  const timeAgo = useTimeAgo();
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const name = person.displayName || (person.username ? `@${person.username}` : t("circle_fallback_name"));
  const moodDot = MOOD_DOTS[person.statusMood] || MOOD_DOTS.neutral;
  const moodLabel = t(`mood_${person.statusMood || "neutral"}`);
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
        className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer active:bg-slate-50 transition-colors"
      >
        <div className="p-3 sm:p-5 space-y-2 sm:space-y-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Avatar src={person.avatarUrl} name={name} size="md" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{name}</h2>
              {person.username && person.displayName && (
                <p className="text-xs sm:text-sm text-slate-500 truncate">@{person.username}</p>
              )}
            </div>
            <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {person.statusText ? (
            <div className="flex items-start gap-2">
              <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${moodDot} mt-1.5 shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-700 line-clamp-2">{person.statusText}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                  {moodLabel} · {timeAgo(person.statusUpdatedAt)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-400 italic">{t("circle_no_status")}</p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] sm:text-xs text-slate-500 shrink-0">{t("circle_prefers")}</span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-full truncate">
                {t(TONE_SHORT_KEYS[person.tonePreference] || "tone_warm_and_gentle_short")}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {bs.red > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] sm:text-xs">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />
                  <span className="text-red-700 font-medium">{bs.red}</span>
                </span>
              )}
              {bs.yellow > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] sm:text-xs">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400" />
                  <span className="text-amber-700 font-medium">{bs.yellow}</span>
                </span>
              )}
              {bs.green > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] sm:text-xs">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-700 font-medium">{bs.green}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/chat/${person.connectionId}`}
            className="flex-1 text-center text-xs sm:text-sm font-medium text-emerald-600 py-2 sm:py-3 hover:bg-emerald-50 transition-colors"
          >
            {t("circle_card_message")}
          </Link>
          <div className="w-px bg-gray-100" />
          <Link
            href={`/them?connectionId=${person.connectionId}`}
            className="flex-1 text-center text-xs sm:text-sm font-medium text-slate-600 py-2 sm:py-3 hover:bg-slate-50 transition-colors"
          >
            {t("circle_card_profile")}
          </Link>
          <div className="w-px bg-gray-100" />
          <Link
            href={`/circle/settings?connectionId=${person.connectionId}`}
            className="flex-1 text-center text-slate-600 py-1.5 sm:py-2.5 hover:bg-slate-50 transition-colors"
          >
            <span className="text-[11px] sm:text-xs font-medium block">{t("circle_card_ai_tuning")}</span>
            <span className="text-[9px] text-slate-400 hidden sm:block">{t("circle_card_ai_tuning_sub")}</span>
          </Link>
        </div>
      </div>

      {/* Boundary popup */}
      {showBoundaries && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowBoundaries(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl flex flex-col animate-[slideUp_0.2s_ease-out] max-h-[85dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">{t("circle_boundaries_title", { name })}</h3>
              <button onClick={() => setShowBoundaries(false)} className="text-slate-400 text-lg p-1" aria-label={t("close")}>✕</button>
            </div>

            <div className="px-5 pt-3 pb-1 shrink-0 flex gap-2">
              <Link
                href={`/them?connectionId=${person.connectionId}`}
                className="flex-1 text-center text-sm font-medium bg-emerald-600 text-white py-2.5 rounded-xl"
              >
                {t("circle_view_full_profile")}
              </Link>
              <Link
                href={`/chat/${person.connectionId}`}
                className="flex-1 text-center text-sm font-medium border border-gray-200 text-slate-700 py-2.5 rounded-xl"
              >
                {t("circle_card_message")}
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              <p className="text-xs text-slate-500">{t("circle_boundaries_hint", { name })}</p>

              {boundaries.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4 text-center">{t("circle_boundaries_empty")}</p>
              ) : (
                <div className="space-y-3">
                  {boundaries.filter((b) => b.comfortLevel === "red").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase mb-1.5">{t("circle_boundaries_avoids")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boundaries.filter((b) => b.comfortLevel === "red").map((b) => (
                          <span key={b.topicName} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">{b.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {boundaries.filter((b) => b.comfortLevel === "yellow").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase mb-1.5">{t("circle_boundaries_gentle")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boundaries.filter((b) => b.comfortLevel === "yellow").map((b) => (
                          <span key={b.topicName} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">{b.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {boundaries.filter((b) => b.comfortLevel === "green").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 uppercase mb-1.5">{t("circle_boundaries_open")}</p>
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

            <div className="p-4 border-t border-gray-100 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {confirmingDisconnect ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-red-700">{t("circle_disconnect_confirm", { name })}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="flex-1 text-xs font-medium bg-red-600 text-white py-2 rounded-lg disabled:opacity-50"
                    >
                      {disconnecting ? t("circle_disconnecting") : t("circle_disconnect_yes")}
                    </button>
                    <button
                      onClick={() => setConfirmingDisconnect(false)}
                      className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-600 py-2 rounded-lg"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDisconnect(true)}
                  className="w-full text-xs text-red-500 font-medium py-2 hover:bg-red-50 rounded-lg"
                >
                  {t("circle_disconnect")}
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
  const { t } = useT();
  const name = person.displayName || (person.username ? `@${person.username}` : person.email || t("circle_someone"));
  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="min-w-0">
        <p className="font-semibold text-slate-800 truncate">{name}</p>
        {person.displayName && person.username && (
          <p className="text-sm text-slate-500 truncate">@{person.username}</p>
        )}
        {!person.displayName && !person.username && (
          <p className="text-sm text-slate-400 truncate">{t("circle_no_username_yet")}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function UsernameCard({ me, onClaimed }) {
  const { t } = useT();
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
        setError(data.detail || t("circle_claim_could_not_save"));
        return;
      }
      setEditing(false);
      onClaimed(data.username);
    } catch {
      setError(t("network_error"));
    } finally {
      setSaving(false);
    }
  }

  if (me?.username && !editing) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-emerald-700">
            {t("circle_your_username")} <span className="font-semibold">@{me.username}</span>
          </p>
          <p className="text-xs text-emerald-500 mt-0.5">{t("circle_username_share")}</p>
        </div>
        <button onClick={() => { setValue(me.username); setEditing(true); }} className="text-sm text-emerald-600 underline">
          {t("circle_change")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div>
        <p className="font-semibold text-slate-800">{t("circle_claim_title")}</p>
        <p className="text-sm text-slate-500">{t("circle_claim_hint")}</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-gray-200 bg-white px-3">
          <span className="text-slate-400">@</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("circle_claim_placeholder")}
            className="w-full px-1 py-2 text-sm focus:outline-none"
            maxLength={20}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}

export default function CirclePage() {
  const { t } = useT();
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
        setError(data.detail || data.error || t("generic_error"));
        return;
      }
      await loadCircle();
      if (query.trim().length >= 2) {
        const searchRes = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (searchRes.ok) setResults((await searchRes.json()).results);
      }
    } catch {
      setError(t("network_error"));
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
    <div className="space-y-3 sm:space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 sm:p-4 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
            {t("dismiss")}
          </button>
        </div>
      )}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t("your_circle")}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">{t("circle_blurb")}</p>
      </div>

      <UsernameCard me={me} onClaimed={(username) => setMe((m) => ({ ...m, username }))} />

      {/* Members as rich cards */}
      {circle.members.length > 0 && (
        <div className="space-y-2 sm:space-y-4">
          {circle.members.map((p) => (
            <PersonCard key={p.connectionId} person={p} onDisconnect={disconnect} />
          ))}
        </div>
      )}

      {circle.members.length === 0 && circle.incoming.length === 0 && circle.outgoing.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center space-y-3">
          <p className="text-base text-emerald-800 font-medium">{t("circle_empty_title")}</p>
          <p className="text-sm text-emerald-600">{t("circle_empty_hint")}</p>
        </div>
      )}

      {circle.incoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("circle_wants_to_connect")}</h2>
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
                    {t("circle_action_accept")}
                  </button>
                  <button
                    onClick={() => respond(p.connectionId, "decline")}
                    disabled={busy !== null}
                    className="text-sm border border-gray-200 text-slate-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {t("circle_action_decline")}
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {circle.outgoing.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("circle_waiting_on_them")}</h2>
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
                  {t("circle_action_cancel")}
                </button>
              }
            />
          ))}
        </div>
      )}

      {/* Search / Invite */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("circle_find_someone")}</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("circle_search_placeholder")}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {searching && <p className="text-sm text-slate-400">{t("circle_searching")}</p>}
        {results && results.length === 0 && !searching && (
          <p className="text-sm text-slate-500">
            {t("circle_no_one_found_invite")}{" "}
            <Link href="/invite" className="underline">{t("circle_invite_by_email")}</Link>.
          </p>
        )}
        {results?.map((r) => (
          <PersonRow
            key={r.id}
            person={r}
            action={
              r.status === "connected" ? (
                <span className="text-sm text-emerald-600 font-medium">{t("circle_status_in_circle")}</span>
              ) : r.status === "request_sent" ? (
                <span className="text-sm text-slate-400">{t("circle_status_requested")}</span>
              ) : r.status === "request_received" ? (
                <button
                  onClick={() => respond(r.connectionId, "accept")}
                  disabled={busy !== null}
                  className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {t("circle_action_accept")}
                </button>
              ) : (
                <button
                  onClick={() => sendRequest(r.id)}
                  disabled={busy !== null}
                  className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {t("circle_action_request")}
                </button>
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
