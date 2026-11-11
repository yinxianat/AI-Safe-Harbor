"use client";

import { useEffect, useState } from "react";
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

const LEVEL_STYLES = {
  green: { bg: "bg-emerald-500", ring: "ring-emerald-200", label: "Open", text: "text-emerald-700" },
  yellow: { bg: "bg-amber-400", ring: "ring-amber-200", label: "Gentle", text: "text-amber-700" },
  red: { bg: "bg-red-500", ring: "ring-red-200", label: "Not Ready", text: "text-red-700" },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatusBubble({ text, mood, updatedAt }) {
  if (!text) {
    return (
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
        <p className="text-sm text-slate-400 italic">No status right now</p>
      </div>
    );
  }
  const moodStyle = MOOD_STYLES[mood] || MOOD_STYLES.neutral;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className={`w-3 h-3 rounded-full ${moodStyle.dot} mt-1 shrink-0 ring-2 ring-white`} />
        <div className="flex-1 min-w-0">
          <p className="text-base text-slate-800">{text}</p>
          <p className="text-xs text-slate-400 mt-1">
            {moodStyle.label} · {timeAgo(updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

function WallPostCard({ post }) {
  const moodStyle = post.mood ? MOOD_STYLES[post.mood] : null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.text}</p>
      <div className="flex items-center gap-2 mt-2">
        {moodStyle && (
          <span className={`w-2 h-2 rounded-full ${moodStyle.dot}`} />
        )}
        <span className="text-xs text-slate-400">
          {new Date(post.createdAt).toLocaleDateString(undefined, {
            month: "short", day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function BoundaryPill({ topic }) {
  const style = LEVEL_STYLES[topic.comfortLevel] || LEVEL_STYLES.green;
  return (
    <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2">
      <div className={`w-3 h-3 rounded-full ${style.bg} ring-2 ${style.ring} shrink-0`} />
      <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{topic.label}</span>
      <span className={`text-xs font-medium ${style.text} shrink-0`}>{style.label}</span>
    </div>
  );
}

export default function ThemPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllBoundaries, setShowAllBoundaries] = useState(false);
  const [connectionId, setConnectionId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
        setConnectionId(member.connectionId);

        const partnerRes = await fetch(`/api/partner?connectionId=${member.connectionId}`);
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
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error === "no_connection") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Your Person</h1>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center space-y-3">
          <p className="text-base text-indigo-800 font-medium">No one in your circle yet</p>
          <p className="text-sm text-indigo-600">
            Add your person so you can see their profile, boundaries, and what&apos;s on their mind.
          </p>
          <Link
            href="/circle"
            className="inline-block bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
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
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error === "network" ? "Network error. Check your connection." : "Could not load partner details."}</p>
        </div>
      </div>
    );
  }

  const { partner, boundaries, knowMe, wall } = data;
  const name = partner.displayName || (partner.username ? `@${partner.username}` : "Your person");

  const nonGreen = boundaries.filter((b) => b.comfortLevel !== "green");
  const displayBoundaries = showAllBoundaries
    ? boundaries
    : nonGreen.length > 0
      ? nonGreen
      : boundaries.slice(0, 5);

  const categorized = {};
  for (const entry of knowMe) {
    if (!categorized[entry.category]) categorized[entry.category] = [];
    categorized[entry.category].push(entry);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
        {partner.username && partner.displayName && (
          <p className="text-sm text-slate-500">@{partner.username}</p>
        )}
      </div>

      <StatusBubble
        text={partner.statusText}
        mood={partner.statusMood}
        updatedAt={partner.statusUpdatedAt}
      />

      {wall && wall.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            What&apos;s on their mind
          </h2>
          {wall.map((post) => (
            <WallPostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Communication style
        </p>
        <p className="text-base font-medium text-slate-800">{partner.toneLabel}</p>
        <p className="text-sm text-slate-500 mt-1">
          Messages you send are tuned to this style before they reach {name}.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Their bandwidth
        </h2>
        {nonGreen.length === 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700">
            All topics are open — {name} is comfortable discussing anything right now.
          </div>
        )}
        <div className="space-y-2">
          {displayBoundaries.map((b) => (
            <BoundaryPill key={b.topicName} topic={b} />
          ))}
        </div>
        {!showAllBoundaries && boundaries.length > displayBoundaries.length && (
          <button onClick={() => setShowAllBoundaries(true)} className="text-sm text-indigo-600 font-medium">
            Show all {boundaries.length} topics
          </button>
        )}
        {showAllBoundaries && nonGreen.length > 0 && (
          <button onClick={() => setShowAllBoundaries(false)} className="text-sm text-slate-500 font-medium">
            Show only boundaries
          </button>
        )}
      </div>

      {knowMe.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Know {name}
          </h2>
          {Object.entries(categorized).map(([cat, entries]) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-600">
                {CATEGORY_LABELS[cat] || cat}
              </h3>
              {entries.map((entry) => (
                <div key={entry.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-sm font-medium text-slate-600">{entry.prompt}</p>
                  <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{entry.answer}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {knowMe.length === 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-500">
            {name} hasn&apos;t shared any Know Me entries yet.
          </p>
        </div>
      )}

      <Link
        href="/compose"
        className="block bg-indigo-600 text-white text-center font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors"
      >
        Send {name} a message
      </Link>
    </div>
  );
}
