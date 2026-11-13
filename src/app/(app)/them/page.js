"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

export default function ThemPage() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const connectionIdParam = searchParams.get("connectionId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionId, setConnectionId] = useState(connectionIdParam);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let connId = connectionIdParam;

        if (!connId) {
          const circleRes = await fetch("/api/circle");
          if (!circleRes.ok || cancelled) {
            if (!cancelled) { setError("no_connection"); setLoading(false); }
            return;
          }
          const circle = await circleRes.json();
          const member = circle.members?.[0];
          if (!member?.connectionId) {
            if (!cancelled) { setError("no_connection"); setLoading(false); }
            return;
          }
          connId = member.connectionId;
          setConnectionId(connId);
        }

        const partnerRes = await fetch(`/api/partner?connectionId=${connId}`);
        if (cancelled) return;

        if (partnerRes.ok) {
          setData(await partnerRes.json());
        } else {
          setError("load_failed");
        }
      } catch {
        if (!cancelled) setError("network");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [connectionIdParam]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error === "no_connection") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("them_your_person")}</h1>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center space-y-3">
          <p className="text-base text-emerald-800 font-medium">{t("them_empty_title")}</p>
          <p className="text-sm text-emerald-600">{t("them_empty_hint")}</p>
          <Link
            href="/circle"
            className="inline-block bg-emerald-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
          >
            {t("them_find_person")}
          </Link>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">{t("tuning_back_to_circle")}</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error === "network" ? t("network_error") : t("them_load_failed")}</p>
        </div>
      </div>
    );
  }

  const { partner, boundaries, knowMe, wall } = data;
  const name = partner.displayName || (partner.username ? `@${partner.username}` : t("circle_fallback_name"));

  const greenTopics = boundaries.filter((b) => b.comfortLevel === "green");
  const redTopics = boundaries.filter((b) => b.comfortLevel === "red");
  const yellowTopics = boundaries.filter((b) => b.comfortLevel === "yellow");

  return (
    <div className="space-y-4">
      <Link href="/circle" className="text-sm text-emerald-600 font-medium">← {t("nav_circle")}</Link>

      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{t("them_profile_header", { name })}</p>

      {/* Profile Card */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <Avatar src={partner.avatarUrl} name={name} size="lg" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{name}</h1>
            {partner.username && partner.displayName && (
              <p className="text-sm text-slate-500 truncate">@{partner.username}</p>
            )}
            {partner.statusText && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${MOOD_DOTS[partner.statusMood] || MOOD_DOTS.neutral} shrink-0`} />
                <p className="text-xs text-slate-500 truncate">{partner.statusText}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* What they're comfortable with */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("them_comfortable_with", { name })}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{t("them_comfortable_hint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-emerald-500 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-bold text-white uppercase tracking-wide">{t("them_enjoys", { name })}</p>
            <span className="text-lg">👍</span>
          </div>
          <div className="bg-white p-3 space-y-1.5">
            {greenTopics.length === 0 && yellowTopics.length === 0 && (
              <p className="text-xs text-slate-400 italic">{t("them_no_topics_set")}</p>
            )}
            {greenTopics.map((b) => (
              <div key={b.topicName} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-slate-700">{b.label}</span>
              </div>
            ))}
            {yellowTopics.map((b) => (
              <div key={b.topicName} className="bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100">
                <span className="text-xs text-amber-700">{b.label}</span>
                <span className="text-[10px] text-amber-500 ml-1">{t("them_gentle_note")}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-red-500 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-bold text-white uppercase tracking-wide">{t("them_avoids", { name })}</p>
            <span className="text-lg">🛡️</span>
          </div>
          <div className="bg-white p-3 space-y-1.5">
            {redTopics.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{t("them_no_avoided")}</p>
            ) : (
              redTopics.map((b) => (
                <div key={b.topicName} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs text-slate-700">{b.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {wall && wall.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">{t("them_about", { name })}</p>
          <div className="space-y-2">
            {wall.map((post) => (
              <div key={post.id} className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{post.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {post.mood && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{t(`mood_${post.mood}`)}</span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {knowMe.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">{t("them_know", { name })}</p>
          {knowMe.map((entry) => (
            <div key={entry.id} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-500">{entry.prompt}</p>
              <p className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap leading-relaxed">{entry.answer}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/chat/${connectionId}`}
          className="block bg-emerald-600 text-white text-center font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors"
        >
          {t("them_message", { name })}
        </Link>
        <Link
          href={`/circle/settings?connectionId=${connectionId}`}
          className="block bg-white border border-emerald-200 text-emerald-700 text-center font-medium py-3 rounded-xl hover:bg-emerald-50 transition-colors"
        >
          {t("them_ai_tuning")}
        </Link>
      </div>
    </div>
  );
}
