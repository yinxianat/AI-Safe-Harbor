"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TrafficLight from "@/components/TrafficLight";

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

const TONE_LABELS = {
  warm_and_gentle: "Warm & gentle",
  direct_and_clear: "Direct & clear",
  playful_and_light: "Playful & light",
  calm_and_neutral: "Calm & neutral",
  encouraging_and_supportive: "Encouraging & supportive",
  brief_and_to_the_point: "Brief & to the point",
  thoughtful_and_reflective: "Thoughtful & reflective",
  reassuring_and_patient: "Reassuring & patient",
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

function BoundaryPill({ topic }) {
  const style = LEVEL_STYLES[topic.comfortLevel] || LEVEL_STYLES.green;
  return (
    <div className="flex items-center gap-2 bg-white/70 rounded-lg border border-amber-100 px-3 py-2">
      <div className={`w-3 h-3 rounded-full ${style.bg} ring-2 ${style.ring} shrink-0`} />
      <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{topic.label}</span>
      <span className={`text-xs font-medium ${style.text} shrink-0`}>{style.label}</span>
    </div>
  );
}

export default function ThemPage() {
  const searchParams = useSearchParams();
  const connectionIdParam = searchParams.get("connectionId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllBoundaries, setShowAllBoundaries] = useState(false);
  const [connectionId, setConnectionId] = useState(connectionIdParam);

  // Guardian settings (your settings for this relationship)
  const [myTone, setMyTone] = useState("warm_and_gentle");
  const [validTones, setValidTones] = useState([]);
  const [myTopicSettings, setMyTopicSettings] = useState([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customError, setCustomError] = useState(null);
  const [showGuardian, setShowGuardian] = useState(false);

  const fetchMyTopics = useCallback(async (connId) => {
    if (!connId) return null;
    const res = await fetch(`/api/settings/topics?connectionId=${connId}`);
    if (res.ok) return (await res.json()).settings || [];
    return null;
  }, []);

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

        const [partnerRes, toneRes] = await Promise.all([
          fetch(`/api/partner?connectionId=${connId}`),
          fetch(`/api/settings/tone?connectionId=${connId}`),
        ]);
        if (cancelled) return;

        if (partnerRes.ok) {
          setData(await partnerRes.json());
        } else {
          setError("load_failed");
        }

        if (toneRes.ok) {
          const toneData = await toneRes.json();
          setMyTone(toneData.tonePreference);
          setValidTones(toneData.validTones || []);
        }

        const topics = await fetchMyTopics(connId);
        if (!cancelled && topics) setMyTopicSettings(topics);
      } catch {
        if (!cancelled) setError("network");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [connectionIdParam, fetchMyTopics]);

  async function handleMyToneChange(newTone) {
    setMyTone(newTone);
    await fetch("/api/settings/tone", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tonePreference: newTone, connectionId }),
    });
  }

  async function handleMyToggle(topicName, newLevel) {
    setMyTopicSettings((prev) =>
      prev.map((s) => (s.topicName === topicName ? { ...s, comfortLevel: newLevel } : s))
    );
    await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, topicName, comfortLevel: newLevel }),
    });
  }

  async function handleAddCustom(e) {
    e.preventDefault();
    setCustomError(null);
    const res = await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, customLabel, comfortLevel: "yellow" }),
    });
    const resData = await res.json();
    if (!res.ok) {
      setCustomError(resData.detail || "Could not add that topic.");
      return;
    }
    setCustomLabel("");
    const topics = await fetchMyTopics(connectionId);
    if (topics) setMyTopicSettings(topics);
  }

  async function handleRemoveCustom(topicName) {
    await fetch("/api/settings/topics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, topicName }),
    });
    const topics = await fetchMyTopics(connectionId);
    if (topics) setMyTopicSettings(topics);
  }

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
            Add your person so you can see their profile and set up your guardian.
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

  const myCustoms = myTopicSettings.filter((s) => s.isCustom);
  const myPresets = myTopicSettings.filter((s) => !s.isCustom);

  const greenTopics = boundaries.filter((b) => b.comfortLevel === "green");
  const redTopics = boundaries.filter((b) => b.comfortLevel === "red");
  const yellowTopics = boundaries.filter((b) => b.comfortLevel === "yellow");

  return (
    <div className="space-y-4">
      <Link href="/circle" className="text-sm text-emerald-600 font-medium">← Circle</Link>

      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{name}&apos;s Profile</p>

      {/* ── Profile Card ── */}
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

      {/* ── What they're comfortable with ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">What {name} is comfortable with</p>
        <p className="text-[10px] text-slate-400 mt-0.5">These are {name}&apos;s preferences — the AI will warn you if your message touches a sensitive topic.</p>
      </div>

      {/* ── Side-by-side Topic Cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Topics they enjoy */}
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

        {/* Topics they avoid */}
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
            <p className="text-[10px] text-slate-400 pt-1">The AI will warn you before sending a message about these topics.</p>
          </div>
        </div>
      </div>

      {/* ── Wall Posts ── */}
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

      {/* ── Know Me ── */}
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

      {/* ── AI Tuning ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowGuardian(!showGuardian)}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-700">AI Tuning</p>
              <p className="text-[10px] text-slate-400">How you receive messages from {name}</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${showGuardian ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showGuardian && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
            <p className="text-xs text-slate-500">The AI adjusts {name}&apos;s messages before they reach you. Choose the tone and set which topics you&apos;re comfortable receiving.</p>

            {/* Tone preference */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Rephrase their messages as</p>
              <select
                value={myTone}
                onChange={(e) => handleMyToneChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm"
              >
                {validTones.map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t] || t}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">{name}&apos;s messages will be rephrased in this tone before you see them.</p>
            </div>

            {/* Topic boundaries */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">Topics you&apos;re comfortable receiving</p>
              <p className="text-[10px] text-slate-400">Red = message held for review. Yellow = softened. Green = comes through normally.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {myPresets.map((setting) => (
                  <TrafficLight
                    key={setting.topicName}
                    topicName={setting.topicName}
                    label={setting.label}
                    comfortLevel={setting.comfortLevel}
                    onToggle={handleMyToggle}
                  />
                ))}
              </div>

              {myCustoms.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {myCustoms.map((setting) => (
                    <div key={setting.topicName} className="relative">
                      <TrafficLight
                        topicName={setting.topicName}
                        label={setting.label}
                        comfortLevel={setting.comfortLevel}
                        onToggle={handleMyToggle}
                      />
                      <button
                        onClick={() => handleRemoveCustom(setting.topicName)}
                        aria-label={`Remove ${setting.label}`}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] leading-5 text-center shadow"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleAddCustom} className="flex gap-2">
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Add a topic..."
                  maxLength={30}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm"
                />
                <button
                  type="submit"
                  disabled={!customLabel.trim()}
                  className="bg-emerald-600 text-white text-sm font-medium px-4 rounded-xl disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              {customError && <p className="text-xs text-red-600">{customError}</p>}
            </div>

            <Link
              href={`/circle/settings?connectionId=${connectionId}`}
              className="block text-center text-xs text-emerald-600 font-medium py-2 bg-emerald-50 rounded-xl"
            >
              Open full AI Tuning settings →
            </Link>
          </div>
        )}
      </div>

      {/* Message CTA */}
      <Link
        href={`/chat/${connectionId}`}
        className="block bg-emerald-600 text-white text-center font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors"
      >
        Message {name}
      </Link>
    </div>
  );
}
