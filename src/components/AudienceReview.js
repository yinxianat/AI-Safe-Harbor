"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context.js";

const TONE_KEYS = {
  warm_and_gentle: "tone_warm_and_gentle",
  direct_and_clear: "tone_direct_and_clear",
  playful_and_light: "tone_playful_and_light",
  calm_and_neutral: "tone_calm_and_neutral",
  encouraging_and_supportive: "tone_encouraging_and_supportive",
  brief_and_to_the_point: "tone_brief_and_to_the_point",
  thoughtful_and_reflective: "tone_thoughtful_and_reflective",
  reassuring_and_patient: "tone_reassuring_and_patient",
};

const REL_KEYS = {
  spouse: "rel_spouse", partner: "rel_partner", friend: "rel_friend",
  sibling: "rel_sibling", parent: "rel_parent", child: "rel_child",
  coworker: "rel_coworker", roommate: "rel_roommate", other: "rel_other",
};

const names = (list) => list.map((c) => c.name).join(", ");
const labels = (topics) => topics.map((t) => t.label).join(", ");

/**
 * Checks a draft against each contact's boundaries as the author types, and
 * reports who it will be withheld from.
 *
 * `onReview` hands the parent the latest verdict so the submit button can be
 * disabled when nobody is left to show the note to.
 */
export function useAudienceReview(text, visibleTo) {
  const [review, setReview] = useState(null);
  const [checking, setChecking] = useState(false);
  // visibleTo is a fresh array each render, so depend on its contents.
  const audienceKey = JSON.stringify(visibleTo || []);

  useEffect(() => {
    if (!text || !text.trim()) {
      setReview(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    // Debounced: the check is keyword-only and cheap, but one request per
    // keystroke still floods the connection on a long note.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/profile/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, visibleTo: JSON.parse(audienceKey) }),
        });
        if (!cancelled && res.ok) setReview(await res.json());
      } catch {
        // A failed check must not block writing; the server re-checks on save.
        if (!cancelled) setReview(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); setChecking(false); };
  }, [text, audienceKey]);

  return { review, checking };
}

export function AudienceReview({ review, checking }) {
  const { t } = useT();

  if (checking && !review) {
    return <p className="text-[11px] text-slate-400">{t("review_checking")}</p>;
  }
  if (!review) return null;

  const { blocked = [], softened = [], perContact = [], blockedEntirely } = review;
  const unverifiable = perContact.filter((c) => c.unenforceable?.length > 0);

  if (blockedEntirely) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-700">
        {t("review_blocked_all")}
      </div>
    );
  }

  if (blocked.length === 0 && softened.length === 0 && unverifiable.length === 0) {
    return (
      <p className="text-[11px] text-emerald-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        {t("review_all_clear")}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {blocked.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 space-y-1">
          <p className="text-[11px] font-semibold text-red-700">
            {t("review_blocked_title", { names: names(blocked) })}
          </p>
          <p className="text-[11px] text-red-700">
            {blocked.length === 1
              ? t("review_blocked_one", { name: blocked[0].name, topics: labels(blocked[0].topics) })
              : t("review_blocked_many", {
                  names: names(blocked),
                  topics: labels(blocked.flatMap((c) => c.topics)),
                })}
          </p>
          {review.deliverableTo?.length > 0 && (
            <p className="text-[10px] text-red-500">
              {t("review_will_reach", {
                count: review.deliverableTo.length,
                total: perContact.length,
              })}
            </p>
          )}
        </div>
      )}

      {softened.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-0.5">
          <p className="text-[11px] font-semibold text-amber-700">{t("review_softened_title")}</p>
          <p className="text-[11px] text-amber-700">
            {t("review_softened_detail", {
              names: names(softened),
              topics: labels(softened.flatMap((c) => c.yellowTopics || c.topics || [])),
            })}
          </p>
        </div>
      )}

      {unverifiable.map((c) => (
        <p key={c.connectionId} className="text-[10px] text-slate-500">
          {t("review_unverifiable", { name: c.name, topics: labels(c.unenforceable) })}
        </p>
      ))}
    </div>
  );
}

/** One reason the rewrite reads the way it does, rendered from a key. */
function Reason({ reason }) {
  const { t } = useT();
  switch (reason.kind) {
    case "tone":
      return <li>{t("why_tone", { tone: t(TONE_KEYS[reason.tone] || "tone_warm_and_gentle") })}</li>;
    case "relationship":
      return <li>{t("why_relationship", { relationship: t(REL_KEYS[reason.relationshipType] || "rel_other") })}</li>;
    case "softened":
      return <li>{t("why_softened", { topics: reason.topics.join(", ") })}</li>;
    case "topic_note":
      return <li>{t("why_topic_note", { topic: reason.topic, note: reason.note })}</li>;
    case "custom":
      return <li>{t("why_custom", { instruction: reason.instruction })}</li>;
    default:
      return null;
  }
}

/**
 * Generates one rewrite per recipient on demand and lets the author accept or
 * skip each. Nothing is stored until the parent saves, so no AI-written text
 * is ever published without being seen.
 */
export function TunePanel({ text, visibleTo, chosen, onChoose, disabled }) {
  const { t } = useT();
  const [variants, setVariants] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  // Which draft the loaded variants belong to, so stale ones are discarded
  // if the author keeps editing after tuning.
  const tunedFor = useRef(null);

  const stale = variants !== null && tunedFor.current !== text;

  const run = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, visibleTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError(t("tune_rate_limited"));
      } else if (!res.ok) {
        setError(t("tune_failed_all"));
      } else if (!data.variants || data.variants.length === 0) {
        setError(t("tune_failed_all"));
      } else {
        setVariants(data.variants);
        tunedFor.current = text;
      }
    } catch {
      setError(t("network_error"));
    }
    setWorking(false);
  }, [text, visibleTo, t]);

  if (!variants || stale) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={run}
          disabled={disabled || working || !text.trim()}
          className="text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {working ? t("tune_working") : t("tune_per_person")}
        </button>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-2">
      <div>
        <p className="text-[11px] font-semibold text-emerald-800">{t("tune_heading")}</p>
        <p className="text-[10px] text-emerald-700">{t("tune_explain")}</p>
      </div>

      {variants.map((v) => {
        const isChosen = chosen?.[v.connectionId] === v.tuned && Boolean(v.tuned);
        if (!v.tuned) {
          return (
            <p key={v.connectionId} className="text-[11px] text-slate-500">
              {t("tune_failed_one", { name: v.name })}
            </p>
          );
        }
        return (
          <div key={v.connectionId} className="bg-white rounded-lg border border-emerald-100 p-2.5 space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-700">
              {t("tune_for", { name: v.name })}
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{v.tuned}</p>

            {v.reasons?.length > 0 && (
              <details className="group">
                <summary className="text-[10px] text-emerald-700 cursor-pointer list-none underline">
                  {t("why_heading")}
                </summary>
                <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500 list-disc list-inside">
                  {v.reasons.map((r, i) => <Reason key={i} reason={r} />)}
                </ul>
              </details>
            )}

            <div className="flex gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onChoose(v.connectionId, v.tuned)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${
                  isChosen
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-emerald-200 text-emerald-700"
                }`}
              >
                {isChosen ? t("tune_used") : t("tune_use")}
              </button>
              <button
                type="button"
                onClick={() => onChoose(v.connectionId, null)}
                className={`text-[11px] px-2.5 py-1 rounded-lg ${
                  isChosen ? "text-slate-500" : "bg-slate-100 text-slate-600 font-medium"
                }`}
              >
                {t("tune_skip")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
