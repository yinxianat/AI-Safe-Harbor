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

const LEVEL_STYLES = {
  green: { bg: "bg-emerald-500", ring: "ring-emerald-200", label: "Open", text: "text-emerald-700" },
  yellow: { bg: "bg-amber-400", ring: "ring-amber-200", label: "Gentle", text: "text-amber-700" },
  red: { bg: "bg-red-500", ring: "ring-red-200", label: "Not Ready", text: "text-red-700" },
};

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

export default function PartnerPage() {
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connectionId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!connectionId) {
      requestAnimationFrame(() => {
        setError("No connection specified.");
        setLoading(false);
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/partner?connectionId=${connectionId}`);
        if (cancelled) return;
        if (res.ok) {
          setData(await res.json());
        } else {
          setError("Could not load partner details.");
        }
      } catch {
        if (!cancelled) setError("Network error. Check your connection and try again.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [connectionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error || "Something went wrong."}</p>
        </div>
        <Link href="/dashboard" className="text-sm text-indigo-600 font-medium">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const { partner, boundaries, knowMe } = data;
  const name = partner.displayName || (partner.username ? `@${partner.username}` : "Your person");

  const nonGreen = boundaries.filter((b) => b.comfortLevel !== "green");
  const green = boundaries.filter((b) => b.comfortLevel === "green");
  const displayBoundaries = showAll ? boundaries : nonGreen.length > 0 ? nonGreen : boundaries.slice(0, 5);

  const categorized = {};
  for (const entry of knowMe) {
    if (!categorized[entry.category]) categorized[entry.category] = [];
    categorized[entry.category].push(entry);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-indigo-600 font-medium">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">{name}</h1>
        {partner.username && partner.displayName && (
          <p className="text-sm text-slate-500">@{partner.username}</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Communication preference
        </p>
        <p className="text-base font-medium text-slate-800">{partner.toneLabel}</p>
        <p className="text-sm text-slate-500 mt-1">
          Messages you send are tuned to this style before they reach {name}.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Their bandwidth right now</h2>
        </div>
        <p className="text-sm text-slate-500">
          These are the topics {name} has set boundaries on. Respect them — they update when ready.
        </p>

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

        {!showAll && boundaries.length > displayBoundaries.length && (
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-indigo-600 font-medium"
          >
            Show all {boundaries.length} topics
          </button>
        )}
        {showAll && nonGreen.length > 0 && (
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-slate-500 font-medium"
          >
            Show only boundaries
          </button>
        )}
      </div>

      {knowMe.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Know {name}</h2>
          <p className="text-sm text-slate-500">
            Things they shared to help you understand them better.
          </p>

          {Object.entries(categorized).map(([cat, entries]) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">
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
    </div>
  );
}
