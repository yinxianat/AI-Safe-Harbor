"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import Avatar from "@/components/Avatar.js";
import { nextVisibleTo, othersStillSeeing } from "@/lib/audience-visibility.js";
import { toneLabelKey } from "@/lib/tones.js";


/**
 * "How others see you": the author's own profile re-rendered once per
 * contact, with the visibility of each piece editable in place.
 *
 * Every other screen in the app answers for one viewer at a time, so nothing
 * ever showed the author that the same status reads one way to one person and
 * is missing entirely for another. This page is the overall picture, and
 * because seeing a wrong audience is useless without being able to correct
 * it, each block carries its own show/hide control.
 */

function Badge({ tone, children }) {
  const styles = {
    shown: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hidden: "bg-slate-100 text-slate-500 border-slate-200",
    tuned: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[tone] || styles.hidden}`}>
      {children}
    </span>
  );
}

/** One piece of the profile, as this audience reads it. */
function AudienceItem({
  heading,
  body,
  meta,
  shown,
  reason,
  blockedTopics,
  tuned,
  name,
  canHide,
  onToggle,
  busy,
}) {
  const { t } = useT();
  const topics = (blockedTopics || []).map((b) => b.label).join(", ");

  return (
    <div className={`rounded-xl border p-3 space-y-1.5 ${shown ? "border-gray-100 bg-white" : "border-dashed border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {heading && <p className="text-xs font-medium text-slate-500">{heading}</p>}
          <p className={`whitespace-pre-wrap text-sm leading-relaxed ${shown ? "text-slate-800" : "text-slate-400 line-through decoration-slate-300"}`}>
            {body}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={shown ? "shown" : "hidden"}>
            {shown ? t("audience_badge_shown") : t("audience_badge_hidden")}
          </Badge>
          {shown && tuned && <Badge tone="tuned">{t("audience_badge_tuned")}</Badge>}
        </div>
      </div>

      {!shown && reason === "audience" && (
        <p className="text-[11px] text-slate-500">{t("audience_reason_audience", { name })}</p>
      )}
      {!shown && reason === "boundary" && (
        <p className="text-[11px] text-amber-700">
          {t("audience_reason_boundary", { name, topics: topics || t("audience_topic_fallback") })}
        </p>
      )}
      {!shown && reason === "private" && (
        <p className="text-[11px] text-slate-500">{t("audience_reason_private")}</p>
      )}
      {/* Re-adding someone whose own boundary blocks the text would look like
          it worked and change nothing, so say so before they try. */}
      {!shown && reason === "audience" && topics && (
        <p className="text-[11px] text-amber-700">{t("audience_boundary_warning", { name, topics })}</p>
      )}

      {meta && <p className="text-[10px] text-slate-400">{meta}</p>}

      <div className="pt-0.5">
        {shown ? (
          canHide ? (
            <button
              onClick={() => onToggle(false)}
              disabled={busy}
              className="text-[11px] font-medium text-slate-500 underline disabled:opacity-50"
            >
              {busy ? t("audience_saving") : t("audience_hide_from", { name })}
            </button>
          ) : (
            <p className="text-[11px] text-slate-400">{t("audience_only_audience", { name })}</p>
          )
        ) : reason === "boundary" ? (
          <p className="text-[11px] text-slate-400">{t("audience_boundary_locked")}</p>
        ) : (
          <button
            onClick={() => onToggle(true)}
            disabled={busy}
            className="text-[11px] font-medium text-emerald-600 underline disabled:opacity-50"
          >
            {busy ? t("audience_saving") : t("audience_show_to", { name })}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AudiencePage() {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/audience");
      if (!res.ok) {
        setError(t("audience_load_failed"));
        return;
      }
      const payload = await res.json();
      setData(payload);
      setSelected((current) => {
        const stillThere = payload.audiences.some((a) => a.connectionId === current);
        return stillThere ? current : payload.audiences[0]?.connectionId || null;
      });
    } catch {
      setError(t("audience_load_failed"));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  /**
   * Writes go to the endpoint that owns the item, which re-derives the
   * boundary exclusions server-side; the whole payload is then reloaded so
   * what is on screen is what the server actually stored, not a guess.
   */
  async function save(busyKey, url, body) {
    setBusyId(busyKey);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(
          payload.error === "blocked_entirely"
            ? t("review_blocked_all")
            : t("audience_save_failed")
        );
      } else {
        await load();
      }
    } catch {
      setError(t("network_error"));
    }
    setBusyId(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  const audiences = data?.audiences || [];
  const allIds = data?.allConnectionIds || [];
  const audience = audiences.find((a) => a.connectionId === selected) || audiences[0];

  // A failed load also leaves no audiences, and reporting that as "you have
  // no contacts" would be a lie about their account rather than the network.
  if (!data) {
    return (
      <div className="space-y-4">
        <Link href="/me" className="text-sm font-medium text-emerald-600">← {t("nav_me")}</Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || t("audience_load_failed")}
        </div>
      </div>
    );
  }

  if (audiences.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/me" className="text-sm font-medium text-emerald-600">← {t("nav_me")}</Link>
        <h1 className="text-xl font-bold text-slate-900">{t("audience_title")}</h1>
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-center">
          <p className="text-sm font-medium text-emerald-800">{t("audience_empty_title")}</p>
          <p className="text-sm text-emerald-700">{t("audience_empty_hint")}</p>
          <Link
            href="/circle"
            className="inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white"
          >
            {t("them_find_person")}
          </Link>
        </div>
      </div>
    );
  }

  const name = audience.label;
  const statusVisibleTo = data.statusVisibleTo || [];
  const statusOnlyAudience =
    othersStillSeeing({ visibleTo: statusVisibleTo }, allIds, audience.connectionId) === 0;

  function toggleStatus(show) {
    save(
      "status",
      "/api/status",
      {
        statusText: data.statusText || "",
        statusVisibleTo: nextVisibleTo(statusVisibleTo, allIds, audience.connectionId, show),
      }
    );
  }

  function togglePost(post, show) {
    save(`post:${post.id}`, "/api/wall", {
      postId: post.id,
      visibleTo: nextVisibleTo(post.visibleTo, allIds, audience.connectionId, show),
    });
  }

  function toggleEntry(entry, show) {
    // A Know Me entry has a real "nobody" state, so hiding it from the last
    // remaining reader is expressible; a note on the wall has no such column.
    const leavesNobody = !show && othersStillSeeing(entry, allIds, audience.connectionId) === 0;

    // Revealing an entry that was hidden from everyone must reveal it to this
    // one person. Its stored audience is still "everyone", so running the
    // normal arithmetic would hand it to every contact at once.
    const revealingPrivate = show && entry.reason === "private";
    const audienceAfter = revealingPrivate && (entry.visibleTo || []).length === 0
      ? [audience.connectionId]
      : nextVisibleTo(entry.visibleTo, allIds, audience.connectionId, show);

    save(`entry:${entry.id}`, "/api/knowme", {
      id: entry.id,
      ...(leavesNobody
        ? { isPublic: false }
        : { isPublic: true, visibleTo: audienceAfter }),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/me" className="text-sm font-medium text-emerald-600">← {t("nav_me")}</Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{t("audience_title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("audience_subtitle")}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="mt-1 text-xs font-medium underline">
            {t("dismiss")}
          </button>
        </div>
      )}

      {/* Audience switcher */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{t("audience_viewing_as")}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {audiences.map((a) => {
            const active = a.connectionId === audience.connectionId;
            return (
              <button
                key={a.connectionId}
                onClick={() => setSelected(a.connectionId)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-gray-200 bg-white text-slate-600"
                }`}
              >
                <Avatar src={a.avatarUrl} name={a.label} size="xs" />
                <span className="max-w-[9rem] truncate text-xs font-medium">{a.label}</span>
                {a.counts.postsHidden + a.counts.knowMeHidden + (a.status.shown ? 0 : 1) > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>
                    {a.counts.postsHidden + a.counts.knowMeHidden + (a.status.shown ? 0 : 1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* The profile card as this audience sees it */}
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t("audience_as_seen_by", { name })}
        </p>
        <div className="flex items-center gap-3">
          <Avatar src={data.profile.avatarUrl} name={data.profile.displayName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">
              {data.profile.displayName || t("me_fallback_name")}
            </p>
            {data.profile.username && (
              <p className="truncate text-sm text-slate-500">@{data.profile.username}</p>
            )}
            {audience.status.shown && audience.status.text ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <p className="truncate text-xs text-slate-500">{audience.status.text}</p>
              </div>
            ) : (
              <p className="mt-1 text-xs italic text-slate-400">
                {data.statusText ? t("audience_status_hidden_short") : t("audience_status_none")}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-100 pt-2">
          <p className="text-[11px] text-slate-500">
            {t("audience_tone_line", {
              name,
              tone: t(toneLabelKey(audience.tonePreference)),
            })}
          </p>
          <Link
            href={`/them?connectionId=${audience.connectionId}`}
            className="text-[11px] font-medium text-emerald-600"
          >
            {t("audience_see_their_profile")}
          </Link>
        </div>
        {audience.shield?.enabled && audience.shield.emotions.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500 border-t border-gray-100 pt-2">
            {t("audience_shield_on", {
              name,
              emotions: audience.shield.emotions.map((e) => t(`emotion_${e}`)).join(", "),
            })}
          </p>
        )}
      </div>

      {/* Status */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase text-slate-500">{t("me_status_section")}</h2>
          <Link href="/me" className="text-[11px] font-medium text-emerald-600">{t("audience_edit_text")}</Link>
        </div>
        {!data.statusText ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm italic text-slate-400">
            {t("audience_status_none")}
          </p>
        ) : (
          <AudienceItem
            body={data.statusText}
            shown={audience.status.shown}
            reason={audience.status.shown ? null : "audience"}
            blockedTopics={[]}
            tuned={false}
            name={name}
            canHide={!statusOnlyAudience}
            onToggle={toggleStatus}
            busy={busyId === "status"}
          />
        )}
      </section>

      {/* Notes (the wall) */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase text-slate-500">
            {t("audience_notes_section")}{" "}
            <span className="font-normal normal-case text-slate-400">
              {t("audience_counts", {
                shown: audience.counts.postsShown,
                hidden: audience.counts.postsHidden,
              })}
            </span>
          </h2>
          <Link href="/story" className="text-[11px] font-medium text-emerald-600">{t("audience_edit_text")}</Link>
        </div>
        {audience.posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm italic text-slate-400">
            {t("audience_notes_empty")}
          </p>
        ) : (
          audience.posts.map((post) => (
            <AudienceItem
              key={post.id}
              body={post.text}
              meta={new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              shown={post.shown}
              reason={post.reason}
              blockedTopics={post.blockedTopics}
              tuned={post.tuned}
              name={name}
              canHide={othersStillSeeing(post, allIds, audience.connectionId) > 0}
              onToggle={(show) => togglePost(post, show)}
              busy={busyId === `post:${post.id}`}
            />
          ))
        )}
      </section>

      {/* Know Me answers */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase text-slate-500">
            {t("audience_knowme_section")}{" "}
            <span className="font-normal normal-case text-slate-400">
              {t("audience_counts", {
                shown: audience.counts.knowMeShown,
                hidden: audience.counts.knowMeHidden,
              })}
            </span>
          </h2>
          <Link href="/knowme" className="text-[11px] font-medium text-emerald-600">{t("audience_edit_text")}</Link>
        </div>
        {audience.knowMe.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm italic text-slate-400">
            {t("audience_knowme_empty")}
          </p>
        ) : (
          audience.knowMe.map((entry) => (
            <AudienceItem
              key={entry.id}
              heading={entry.prompt}
              body={entry.answer}
              shown={entry.shown}
              reason={entry.reason}
              blockedTopics={entry.blockedTopics}
              tuned={entry.tuned}
              name={name}
              canHide
              onToggle={(show) => toggleEntry(entry, show)}
              busy={busyId === `entry:${entry.id}`}
            />
          ))
        )}
      </section>

      <p className="pb-2 text-[11px] text-slate-400">{t("audience_everyone_note")}</p>
    </div>
  );
}
