"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import Avatar from "@/components/Avatar.js";
import VoiceInput from "@/components/VoiceInput.js";
import { toneShortLabelKey } from "@/lib/tones.js";
import { useTimeAgo } from "@/lib/time-ago.js";

function PersonCard({ person, onDisconnect, onNicknameChange, startOpen = false, onClosed }) {
  const { t } = useT();
  const timeAgo = useTimeAgo();
  // When the caller already rendered this person (from the people strip),
  // the full card is unnecessary noise above the boundary sheet — the strip
  // is already on screen. Hide the card body in that mode and show only the
  // sheet, so opening from the strip feels like opening a profile rather
  // than re-rendering a card already shown.
  const hideCardBody = startOpen;
  const [showBoundaries, setShowBoundaries] = useState(startOpen);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nickDraft, setNickDraft] = useState(person.nickname || "");
  const [savingNick, setSavingNick] = useState(false);
  // Nickname takes priority so the card always shows the name the user chose.
  const name = person.nickname || person.displayName || (person.username ? `@${person.username}` : t("circle_fallback_name"));
  const realName = person.displayName || (person.username ? `@${person.username}` : null);
  const bs = person.boundarySummary || { red: 0, yellow: 0, green: 0 };
  const boundaries = person.boundaries || [];

  async function handleDisconnect() {
    setDisconnecting(true);
    await onDisconnect(person.connectionId);
    setDisconnecting(false);
    setConfirmingDisconnect(false);
    setShowBoundaries(false);
  }

  async function saveNickname(raw = nickDraft) {
    const nickname = (raw || "").trim() || null;
    setSavingNick(true);
    try {
      const res = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: person.connectionId, nickname }),
      });
      if (res.ok) {
        onNicknameChange(person.connectionId, nickname);
        setEditingNickname(false);
      }
    } catch { /* ignore */ }
    setSavingNick(false);
  }

  return (
    <>
      {!hideCardBody && (
      <div
        onClick={() => setShowBoundaries(true)}
        className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer active:bg-slate-50 transition-colors"
      >
        <div className="p-3 sm:p-5 space-y-2 sm:space-y-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Avatar src={person.avatarUrl} name={name} size="md" />
            {/* Renaming lives on the card itself, not only inside the detail
                sheet: the list is where someone realises they cannot tell two
                contacts apart, and a contact can change their own display
                name at any time. */}
            {editingNickname ? (
              <div className="min-w-0 flex-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  value={nickDraft}
                  onChange={(e) => setNickDraft(e.target.value)}
                  placeholder={t("circle_nickname_placeholder")}
                  maxLength={50}
                  autoFocus
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => saveNickname()}
                    disabled={savingNick}
                    className="text-xs font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {savingNick ? "…" : t("save")}
                  </button>
                  <button
                    onClick={() => { setEditingNickname(false); setNickDraft(person.nickname || ""); }}
                    className="text-xs text-slate-500"
                  >
                    {t("cancel")}
                  </button>
                  {person.nickname && (
                    <button
                      onClick={() => { setNickDraft(""); saveNickname(""); }}
                      disabled={savingNick}
                      className="text-xs text-slate-500 underline disabled:opacity-50"
                    >
                      {t("circle_nickname_clear")}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">{t("circle_nickname_hint")}</p>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{name}</h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNickDraft(person.nickname || "");
                        setEditingNickname(true);
                      }}
                      className="text-[10px] sm:text-xs font-medium text-emerald-600 shrink-0"
                    >
                      {person.nickname ? t("edit") : t("circle_rename")}
                    </button>
                  </div>
                  {/* When a nickname is set, show the real name underneath */}
                  {person.nickname && realName ? (
                    <p className="text-xs sm:text-sm text-slate-500 truncate">{realName}</p>
                  ) : person.username && person.displayName ? (
                    <p className="text-xs sm:text-sm text-slate-500 truncate">@{person.username}</p>
                  ) : null}
                </div>
                <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </div>

          {person.statusText ? (
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-700 line-clamp-2">{person.statusText}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                  {timeAgo(person.statusUpdatedAt)}
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
                {t(toneShortLabelKey(person.tonePreference))}
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
      )}

      {/* Boundary popup */}
      {showBoundaries && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => { setShowBoundaries(false); onClosed?.(); }}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl flex flex-col animate-[slideUp_0.2s_ease-out] max-h-[85dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">{t("circle_boundaries_title", { name })}</h3>
              <button onClick={() => { setShowBoundaries(false); onClosed?.(); }} className="text-slate-400 text-lg p-1" aria-label={t("close")}>✕</button>
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
              {/* Nickname editor */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">{t("circle_nickname")}</p>
                {editingNickname ? (
                  <div className="flex gap-2">
                    <input
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      placeholder={t("circle_nickname_placeholder")}
                      maxLength={50}
                      className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={saveNickname}
                      disabled={savingNick}
                      className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {savingNick ? "…" : t("save")}
                    </button>
                    <button onClick={() => setEditingNickname(false)} className="text-xs text-slate-500 px-2">
                      {t("cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-700">
                      {person.nickname || <span className="text-slate-400 italic">{t("circle_nickname_hint")}</span>}
                    </p>
                    <button
                      onClick={() => { setNickDraft(person.nickname || ""); setEditingNickname(true); }}
                      className="text-xs text-emerald-600 font-medium shrink-0"
                    >
                      {person.nickname ? t("edit") : t("circle_change")}
                    </button>
                  </div>
                )}
              </div>

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
                          <span key={b.topicName} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">{b.labelKey ? t(b.labelKey) : b.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {boundaries.filter((b) => b.comfortLevel === "yellow").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase mb-1.5">{t("circle_boundaries_gentle")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boundaries.filter((b) => b.comfortLevel === "yellow").map((b) => (
                          <span key={b.topicName} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">{b.labelKey ? t(b.labelKey) : b.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {boundaries.filter((b) => b.comfortLevel === "green").length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 uppercase mb-1.5">{t("circle_boundaries_open")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {boundaries.filter((b) => b.comfortLevel === "green").map((b) => (
                          <span key={b.topicName} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">{b.labelKey ? t(b.labelKey) : b.label}</span>
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


/**
 * Horizontal strip of people, Instagram-story style but static — one
 * avatar per contact, with the name underneath. Tapping one asks the page
 * to open that person's boundary sheet, which is where the rich card
 * actions (relabel, disconnect, see boundaries) live.
 *
 * Kept visually compact and scrollable because the point of this page is
 * now the feed below. A wall of per-person cards pushed every recent
 * update below the fold, which is the opposite of what the product asks
 * for.
 */
// Attention thresholds for the people strip.
//
// Chosen to give the strip three visible classes at a glance — "they
// wrote you something you haven't seen", "they've been active lately",
// and "they've been quiet a while" — without a legend. Thresholds
// deliberately coarse: narrower bands would flicker on the boundary and
// the extra signal is not worth the instability.
const FRESH_MS = 3 * 24 * 60 * 60 * 1000;
const QUIET_MS = 30 * 24 * 60 * 60 * 1000;

function peopleAttention(p) {
  if (p.unreadCount > 0) return "unread";
  if (!p.lastActiveAt) return "quiet";
  const age = Date.now() - new Date(p.lastActiveAt).getTime();
  if (age < FRESH_MS) return "fresh";
  if (age > QUIET_MS) return "quiet";
  return "normal";
}

function PeopleStrip({ members, onOpenPerson }) {
  const { t } = useT();
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {t("circle_people_section")}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {members.map((p) => {
          const name =
            p.nickname
            || p.displayName
            || (p.username ? `@${p.username}` : t("circle_fallback_name"));
          const attention = peopleAttention(p);
          const ringClass =
            attention === "unread"
              ? "ring-2 ring-emerald-600"
              : attention === "fresh"
                ? "ring-2 ring-emerald-300"
                : "";
          // Quiet contacts go to 60% opacity — present but visually
          // demoted, so the operator can see who they've drifted from
          // without hiding anyone.
          const fade = attention === "quiet" ? "opacity-60" : "";
          return (
            <button
              key={p.connectionId}
              onClick={() => onOpenPerson(p.connectionId)}
              className={`shrink-0 w-16 text-center group ${fade}`}
              aria-label={t("chat_open_profile", { name })}
              title={
                attention === "unread"
                  ? t("circle_people_unread", { count: p.unreadCount })
                  : attention === "fresh"
                    ? t("circle_people_fresh")
                    : attention === "quiet"
                      ? t("circle_people_quiet")
                      : undefined
              }
            >
              <div className={`relative inline-block rounded-full ${ringClass}`}>
                <Avatar src={p.avatarUrl} name={name} size="md" tone="solid" />
                {p.unreadCount > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white"
                    aria-hidden="true"
                  >
                    {p.unreadCount > 9 ? "9+" : p.unreadCount}
                  </span>
                ) : p.statusText ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-slate-700 group-hover:text-emerald-700 truncate">
                {name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The feed itself — merged status updates and wall posts from every active
 * contact, newest first. Reads from /api/feed, which does the audience
 * filtering server side so a post hidden from this reader on the author's
 * end stays hidden here.
 */
function FeedCard() {
  const { t } = useT();
  const timeAgo = useTimeAgo();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feed");
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          setItems([]);
          return;
        }
        const data = await res.json();
        setItems(data.items || []);
      } catch {
        if (!cancelled) {
          setError(true);
          setItems([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (items === null) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-4 text-center space-y-1">
        <p className="text-sm font-medium text-slate-700">{t("circle_feed_empty_title")}</p>
        <p className="text-xs text-slate-500">
          {error ? t("circle_feed_load_failed") : t("circle_feed_empty_hint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {t("circle_feed_section")}
      </p>
      {items.map((item) => (
        <FeedItem key={item.id} item={item} timeAgo={timeAgo} />
      ))}
    </div>
  );
}

function FeedItem({ item, timeAgo }) {
  const { t } = useT();
  const kindLabel =
    item.kind === "status"
      ? t("circle_feed_kind_status")
      : item.kind === "rediscovery"
        ? t("circle_feed_kind_rediscovery")
        : t("circle_feed_kind_post");

  // Rediscovery items are intentionally muted so the reader does not
  // mistake them for brand-new activity — they are context, not news.
  const outer = item.isRediscovery
    ? "bg-amber-50/60 border border-amber-100 rounded-xl p-3 sm:p-4"
    : "bg-white border border-gray-100 rounded-xl p-3 sm:p-4";

  return (
    <article className={outer}>
      <div className="flex items-start gap-3">
        <Link
          href={`/them?connectionId=${item.connectionId}`}
          className="shrink-0 rounded-full"
          aria-label={t("chat_open_profile", { name: item.author.name || "" })}
        >
          <Avatar
            src={item.author.avatarUrl}
            name={item.author.name || "?"}
            size="sm"
            tone="slate"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link
              href={`/them?connectionId=${item.connectionId}`}
              className="text-sm font-semibold text-slate-900 hover:text-emerald-700 truncate"
            >
              {item.author.name || t("circle_fallback_name")}
            </Link>
            <span className={`text-[10px] uppercase tracking-wide ${item.isRediscovery ? "text-amber-700" : "text-slate-400"}`}>
              {kindLabel}
            </span>
            {item.softened && (
              <span
                className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5"
                title={t("shield_crisis_note")}
              >
                {t("shield_badge_softened")}
              </span>
            )}
            <span className="text-[11px] text-slate-400 ml-auto">
              {timeAgo(item.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
            {item.text}
          </p>
        </div>
      </div>
    </article>
  );
}

/**
 * "Me" header card for the folks page, in the style LinkedIn uses: a short
 * identity block, the state of what the user has written about themselves,
 * and a direct way to add more if they haven't written anything yet.
 *
 * It replaces the plain username-claim strip that lived here before. The
 * username claim still appears when they haven't picked one — it is just
 * folded into the card so there is one "about me" surface, not two.
 */
function MeCard({ me, onUsernameClaimed }) {
  const { t } = useT();
  const [summary, setSummary] = useState(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/summary");
        if (cancelled || !res.ok) return;
        setSummary(await res.json());
      } catch { /* leave null; card still renders */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const displayName =
    me?.displayName
    || (me?.username ? `@${me.username}` : t("me_fallback_name"));
  const hasUsername = Boolean(me?.username);
  const storyCount = summary?.story?.count ?? 0;
  const knowMeCount = summary?.knowMe?.count ?? 0;
  const storyLatest = summary?.story?.latest?.text || null;
  const knowMeLatest = summary?.knowMe?.latest;
  const totalContacts = summary?.totalContacts ?? 0;
  const storyReach = summary?.story?.latestReach ?? null;
  const knowMeReach = summary?.knowMe?.latestReach ?? null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
      {/* Identity row. Avatar links to the Me page (editing your own name,
          photo and status lives there), so the gesture is the same one the
          chat cards use for other people. */}
      <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4">
        <Link
          href="/me"
          className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-emerald-200 transition-shadow"
          aria-label={t("circle_me_open_me")}
        >
          <Avatar
            src={me?.avatarUrl}
            name={displayName}
            size="lg"
            tone={me?.avatarUrl ? "slate" : "emerald"}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-base sm:text-lg font-bold text-slate-900 truncate">
            {displayName}
          </p>
          {hasUsername ? (
            <p className="text-xs sm:text-sm text-slate-500 truncate">
              @{me.username}
              <span className="text-slate-400"> · {t("circle_username_share")}</span>
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500">
              {t("circle_me_no_username_hint")}
            </p>
          )}
        </div>
      </div>

      {/* Claim flow, inline. Only shown when the user has no username yet,
          because once they've claimed one it goes above as the secondary
          line. Keeping the previous dedicated card would mean two surfaces
          arguing about where "about me" lives. */}
      {!hasUsername && (
        <UsernameClaimStrip
          onClaimed={(username) => onUsernameClaimed(username)}
          busy={claiming}
          setBusy={setClaiming}
        />
      )}

      {/* About-me and Know-me quick views. They are the two self-description
          surfaces the app has, and this card is where those surfaces live
          alongside the identity. */}
      <div className="border-t border-gray-100 divide-y divide-gray-100">
        <SelfSection
          href="/story"
          label={t("me_open_story")}
          count={storyCount}
          countLabel={t("circle_me_notes_count", { count: storyCount })}
          emptyHint={t("circle_me_notes_empty_hint")}
          emptyAction={t("circle_me_add_first_note")}
          preview={storyLatest}
          reach={storyReach}
          totalContacts={totalContacts}
        />
        <SelfSection
          href="/knowme"
          label={t("me_open_knowme")}
          count={knowMeCount}
          countLabel={t("circle_me_knowme_count", { count: knowMeCount })}
          emptyHint={t("circle_me_knowme_empty_hint")}
          emptyAction={t("circle_me_add_first_knowme")}
          preview={knowMeLatest
            ? `${knowMeLatest.prompt} — ${knowMeLatest.answer}`
            : null}
          reach={knowMeReach}
          totalContacts={totalContacts}
        />
      </div>
    </div>
  );
}

/**
 * One row inside MeCard. Carries two states: either there is something
 * written (show the count and the preview) or there isn't (show a prompt
 * to start, because that is what someone opening this page actually
 * needs to see first).
 */
function SelfSection({ href, label, count, countLabel, emptyHint, emptyAction, preview, reach, totalContacts }) {
  const { t } = useT();
  const empty = count === 0 || !preview;
  // Reach is meaningful only when both the latest item exists AND there
  // is at least one contact to compare against. "visible to 0 of 0" is
  // noise.
  const showReach = !empty && typeof reach === "number" && totalContacts > 0;
  // A hidden latest item (reach = 0 against a non-zero audience) is the
  // one the author most needs to know about — it reads as "I posted
  // something; nobody's seeing it".
  const reachWarn = showReach && reach === 0;
  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-slate-50 active:bg-slate-50 transition-colors"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <div className="flex items-center gap-2 shrink-0">
            {showReach && (
              <p className={`text-[11px] ${reachWarn ? "text-amber-700" : "text-slate-500"}`}>
                {t("circle_me_reach", { reach, total: totalContacts })}
              </p>
            )}
            <p className="text-[11px] text-slate-500">{countLabel}</p>
          </div>
        </div>
        {empty ? (
          // One-line empty state: the paragraph version pushed the first
          // contact's avatar off-screen on a tight phone, and the long
          // sentence wasn't carrying any information the action line
          // didn't already imply.
          <p className="text-[11px] font-medium text-emerald-600">{emptyAction} →</p>
        ) : (
          <p className="text-[11px] text-slate-600 line-clamp-2">{preview}</p>
        )}
      </div>
      <svg className="w-4 h-4 text-slate-300 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/**
 * Compact username claim form, lives inside MeCard when the user has not
 * picked one yet. Logic matches the old UsernameCard; the UI is smaller
 * because a claim strip sitting under an identity row should not look like
 * its own section.
 */
function UsernameClaimStrip({ onClaimed, busy, setBusy }) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
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
      onClaimed(data.username);
      setValue("");
    } catch {
      setError(t("network_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="border-t border-gray-100 bg-emerald-50/50 px-3 sm:px-4 py-2.5 space-y-1.5"
    >
      <p className="text-[11px] text-emerald-700">{t("circle_claim_hint")}</p>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-gray-200 bg-white px-3">
          <span className="text-slate-400">@</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("circle_claim_placeholder")}
            className="w-full px-1 py-1.5 text-sm focus:outline-none"
            maxLength={20}
          />
        </div>
        <button
          type="submit"
          disabled={busy || value.trim().length < 2}
          className="bg-emerald-600 text-white text-xs font-medium px-3 rounded-lg disabled:opacity-50"
        >
          {busy ? t("saving") : t("circle_claim_action")}
        </button>
      </div>
    </form>
  );
}

/**
 * Find-someone card, moved up above the people strip. Facebook-style: a
 * single search field at the top of the page with live results.
 *
 * Collapsible rather than always showing results: on the folks page the
 * primary content is the feed below, so the search card is a bar until the
 * user focuses it or types.
 */
function FindSomeoneCard({
  query,
  setQuery,
  results,
  searching,
  busy,
  onRequest,
  onRespond,
}) {
  const { t } = useT();
  const hasQuery = query.trim().length >= 2;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 sm:p-4 space-y-2">
      <label className="relative block">
        <span className="sr-only">{t("circle_find_someone")}</span>
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("circle_find_someone_placeholder")}
          className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-gray-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <VoiceInput
            onTranscript={(spoken) => setQuery(spoken.trim())}
            className="p-1.5"
          />
        </div>
      </label>

      {!hasQuery && (
        <p className="text-[11px] text-slate-500">
          {t("circle_find_someone_hint")}{" "}
          <Link href="/invite" className="font-medium text-emerald-600 hover:underline">
            {t("circle_invite_by_email")}
          </Link>.
        </p>
      )}

      {hasQuery && searching && (
        <p className="text-xs text-slate-400">{t("circle_searching")}</p>
      )}

      {hasQuery && results && results.length === 0 && !searching && (
        <p className="text-xs text-slate-500">
          {t("circle_no_one_found_invite")}{" "}
          <Link href="/invite" className="underline font-medium">
            {t("circle_invite_by_email")}
          </Link>.
        </p>
      )}

      {hasQuery && results?.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {results.map((r) => (
            <PersonRow
              key={r.id}
              person={r}
              action={
                r.status === "connected" ? (
                  <span className="text-xs text-emerald-600 font-medium">{t("circle_status_in_circle")}</span>
                ) : r.status === "request_sent" ? (
                  <span className="text-xs text-slate-400">{t("circle_status_requested")}</span>
                ) : r.status === "request_received" ? (
                  <button
                    onClick={() => onRespond(r.connectionId, "accept")}
                    disabled={busy !== null}
                    className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {t("circle_action_accept")}
                  </button>
                ) : (
                  <button
                    onClick={() => onRequest(r.id)}
                    disabled={busy !== null}
                    className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {t("circle_action_request")}
                  </button>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
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
  // When the user taps a person in the strip, this holds their connectionId
  // and the sheet-style PersonCard is mounted below. Null = nobody open.
  const [focusedConnectionId, setFocusedConnectionId] = useState(null);
  const focusedPerson = circle.members.find((m) => m.connectionId === focusedConnectionId) || null;

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

      {/* "You" block, LinkedIn-style: who you are and what you've written
          about yourself, so this page opens with your own profile at the top
          before showing you other people's updates. */}
      <MeCard
        me={me}
        onUsernameClaimed={(username) => setMe((m) => ({ ...m, username }))}
      />

      {/* Find someone is above the people strip now, which is where a
          Facebook-style feed would also put search. Kept visually quiet so it
          does not steal from the feed below. */}
      <FindSomeoneCard
        query={query}
        setQuery={setQuery}
        results={results}
        searching={searching}
        busy={busy}
        onRequest={sendRequest}
        onRespond={respond}
      />

      {/* People strip + feed. Rich per-person cards still exist — they open
          from the people strip — because the primary mode on this page is now
          the feed, not the card wall. The feed is the Facebook-style "what
          have your folks been up to" view the product asked for. */}
      {circle.members.length > 0 && (
        <>
          <PeopleStrip
            members={circle.members}
            onOpenPerson={setFocusedConnectionId}
          />
          <FeedCard />
        </>
      )}

      {focusedPerson && (
        <PersonCard
          person={focusedPerson}
          onDisconnect={disconnect}
          onNicknameChange={(connId, nick) => {
            setCircle((prev) => ({
              ...prev,
              members: prev.members.map((m) =>
                m.connectionId === connId ? { ...m, nickname: nick } : m
              ),
            }));
          }}
          startOpen
          onClosed={() => setFocusedConnectionId(null)}
        />
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

    </div>
  );
}
