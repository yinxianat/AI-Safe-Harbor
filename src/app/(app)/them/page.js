"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const CATEGORY_LABELS = {
  about_me: "About Me",
  favorites: "Favorites",
  love_languages: "Love Languages",
  pet_peeves: "Pet Peeves",
  stories: "Stories",
};

const MOOD_STYLES = {
  calm: { dot: "bg-blue-400", label: "Calm" },
  happy: { dot: "bg-emerald-400", label: "Happy" },
  energetic: { dot: "bg-orange-400", label: "Energetic" },
  low: { dot: "bg-slate-400", label: "Low energy" },
  neutral: { dot: "bg-violet-400", label: "Neutral" },
};

export default function ThemPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Your Person</h1>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 text-center space-y-3">
          <p className="text-base text-emerald-800 font-medium">No one in your circle yet</p>
          <p className="text-sm text-emerald-600">
            Add your person so you can see their profile.
          </p>
          <Link
            href="/circle"
            className="inline-block bg-emerald-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Find your person
          </Link>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">← Back to Circle</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error === "network" ? "Network error. Check your connection." : "Could not load details."}</p>
        </div>
      </div>
    );
  }

  const { partner, boundaries, knowMe, wall } = data;
  const name = partner.displayName || (partner.username ? `@${partner.username}` : "Your person");

  const categorized = {};
  for (const entry of knowMe) {
    if (!categorized[entry.category]) categorized[entry.category] = [];
    categorized[entry.category].push(entry);
  }

  const greenTopics = boundaries.filter((b) => b.comfortLevel === "green");
  const redTopics = boundaries.filter((b) => b.comfortLevel === "red");
  const yellowTopics = boundaries.filter((b) => b.comfortLevel === "yellow");

  return (
    <div className="space-y-4">
      <Link href="/circle" className="text-sm text-emerald-600 font-medium">← Circle</Link>

      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{name}&apos;s Profile</p>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 uppercase">{name}</h1>
            {partner.username && partner.displayName && (
              <p className="text-sm text-slate-500">@{partner.username}</p>
            )}
            {partner.statusText && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${(MOOD_STYLES[partner.statusMood] || MOOD_STYLES.neutral).dot} shrink-0`} />
                <p className="text-xs text-slate-500 truncate">{partner.statusText}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* What they're comfortable with */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">What {name} is comfortable with</p>
        <p className="text-[10px] text-slate-400 mt-0.5">The AI will warn you if your message touches a sensitive topic.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-emerald-500 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-bold text-white uppercase tracking-wide">{name} enjoys</p>
            <span className="text-lg">👍</span>
          </div>
          <div className="bg-white p-3 space-y-1.5">
            {greenTopics.length === 0 && yellowTopics.length === 0 && (
              <p className="text-xs text-slate-400 italic">No topics set</p>
            )}
            {greenTopics.map((b) => (
              <div key={b.topicName} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-slate-700">{b.label}</span>
              </div>
            ))}
            {yellowTopics.map((b) => (
              <div key={b.topicName} className="bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100">
                <span className="text-xs text-amber-700">{b.label}</span>
                <span className="text-[10px] text-amber-500 ml-1">(gentle)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-red-500 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-bold text-white uppercase tracking-wide">{name} avoids</p>
            <span className="text-lg">🛡️</span>
          </div>
          <div className="bg-white p-3 space-y-1.5">
            {redTopics.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No avoided topics</p>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">{name}&apos;s Wall</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {wall.map((post) => (
              <div key={post.id} className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {post.mood && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{post.mood}</span>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Know {name}</p>
          {Object.entries(categorized).map(([cat, entries]) => (
            <div key={cat} className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase">{CATEGORY_LABELS[cat] || cat}</p>
              {entries.map((entry) => (
                <div key={entry.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-slate-500">{entry.prompt}</p>
                  <p className="text-sm text-slate-800 mt-0.5">{entry.answer}</p>
                </div>
              ))}
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
          Message {name}
        </Link>
        <Link
          href={`/circle/settings?connectionId=${connectionId}`}
          className="block bg-white border border-emerald-200 text-emerald-700 text-center font-medium py-3 rounded-xl hover:bg-emerald-50 transition-colors"
        >
          AI Tuning
        </Link>
      </div>
    </div>
  );
}
