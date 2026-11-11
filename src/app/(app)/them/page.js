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
            Add your person so you can see their profile and set up your guardian.
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
        <Link href="/circle" className="text-sm text-indigo-600 font-medium">← Back to Circle</Link>
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

  return (
    <div className="space-y-0">
      <Link href="/circle" className="text-sm text-indigo-600 font-medium mb-2 inline-block">← Circle</Link>

      {/* ═══════ ZONE 1: Their World (warm tones) ═══════ */}
      <div className="bg-amber-50/40 rounded-2xl border border-amber-100 p-5 space-y-5 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
            {name}&apos;s Profile
          </span>
          <span className="text-xs text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full">What they shared</span>
        </div>

        {/* Name */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
          {partner.username && partner.displayName && (
            <p className="text-sm text-slate-500">@{partner.username}</p>
          )}
        </div>

        {/* Status */}
        {partner.statusText ? (
          <div className="bg-white/70 rounded-xl border border-amber-100 p-4">
            <div className="flex items-start gap-3">
              <span className={`w-3 h-3 rounded-full ${(MOOD_STYLES[partner.statusMood] || MOOD_STYLES.neutral).dot} mt-1 shrink-0 ring-2 ring-white`} />
              <div className="flex-1 min-w-0">
                <p className="text-base text-slate-800">{partner.statusText}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {(MOOD_STYLES[partner.statusMood] || MOOD_STYLES.neutral).label} · {timeAgo(partner.statusUpdatedAt)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/50 border border-amber-100 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-400 italic">No status right now</p>
          </div>
        )}

        {/* Wall */}
        {wall && wall.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-amber-700">{name}&apos;s Wall</h2>
            {wall.slice(0, 3).map((post) => (
              <div key={post.id} className="bg-white/70 rounded-xl border border-amber-100 p-4">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.text}</p>
                <span className="text-xs text-slate-400 mt-2 block">
                  {new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Communication style */}
        <div className="bg-white/70 rounded-xl border border-amber-100 p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
            {name}&apos;s Preferred Tone
          </p>
          <p className="text-base font-medium text-slate-800">{partner.toneLabel}</p>
          <p className="text-sm text-slate-500 mt-1">
            Messages you send are tuned to this style before they reach {name}.
          </p>
        </div>

        {/* Their boundaries */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-700">{name}&apos;s Boundaries</h2>
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
            <button onClick={() => setShowAllBoundaries(true)} className="text-sm text-amber-700 font-medium">
              Show all {boundaries.length} topics
            </button>
          )}
          {showAllBoundaries && nonGreen.length > 0 && (
            <button onClick={() => setShowAllBoundaries(false)} className="text-sm text-slate-500 font-medium">
              Show only boundaries
            </button>
          )}
        </div>

        {/* Know Me */}
        {knowMe.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-amber-700">Know {name}</h2>
            {Object.entries(categorized).map(([cat, entries]) => (
              <div key={cat} className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-600">
                  {CATEGORY_LABELS[cat] || cat}
                </h3>
                {entries.map((entry) => (
                  <div key={entry.id} className="bg-white/70 rounded-xl border border-amber-100 p-4">
                    <p className="text-sm font-medium text-slate-600">{entry.prompt}</p>
                    <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{entry.answer}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {knowMe.length === 0 && (
          <div className="bg-white/50 border border-amber-100 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500">
              {name} hasn&apos;t shared any Know Me entries yet.
            </p>
          </div>
        )}
      </div>

      {/* ═══════ DIVIDER ═══════ */}
      <div className="flex items-center gap-3 py-6">
        <div className="flex-1 h-px bg-indigo-200" />
        <button
          onClick={() => setShowGuardian(!showGuardian)}
          className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-200 hover:bg-indigo-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {showGuardian ? "Hide" : "Show"} Your Guardian Settings
          <svg className={`w-4 h-4 transition-transform ${showGuardian ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className="flex-1 h-px bg-indigo-200" />
      </div>

      {/* ═══════ ZONE 2: Your Guardian (cool indigo tones) ═══════ */}
      {showGuardian && (
        <div className="bg-indigo-50/40 rounded-2xl border border-indigo-100 p-5 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">
              Your Guardian Settings
            </span>
            <span className="text-xs text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">For messages from {name}</span>
          </div>

          <p className="text-sm text-indigo-600">
            Your AI guardian checks every message from {name} against these settings before it reaches you.
          </p>

          {/* Your tone preference */}
          <div className="bg-white/70 rounded-xl border border-indigo-100 p-4">
            <label htmlFor="myTone" className="block text-sm font-medium text-slate-800 mb-1">
              Your preferred tone
            </label>
            <p className="text-xs text-indigo-500 mb-3">
              Messages from {name} are tuned to this tone before they reach you.
            </p>
            <select
              id="myTone"
              value={myTone}
              onChange={(e) => handleMyToneChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 bg-white text-sm"
            >
              {validTones.map((t) => (
                <option key={t} value={t}>{TONE_LABELS[t] || t}</option>
              ))}
            </select>
          </div>

          {/* Your topic boundaries */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-indigo-700">Your topic boundaries</h3>
              <p className="text-xs text-indigo-500 mt-1">
                Red = your guardian holds the message. Yellow = softened. Green = passes through.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-indigo-700">Your own topics</h3>
              {myCustoms.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs leading-6 text-center shadow"
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
                  placeholder="Add a topic, e.g. wedding planning"
                  maxLength={30}
                  className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 bg-white text-sm"
                />
                <button
                  type="submit"
                  disabled={!customLabel.trim()}
                  className="bg-indigo-600 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
                >
                  Add
                </button>
              </form>
              {customError && <p className="text-sm text-red-600">{customError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Send message CTA */}
      <div className="pt-4">
        <Link
          href="/compose"
          className="block bg-indigo-600 text-white text-center font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Send {name} a message
        </Link>
      </div>
    </div>
  );
}
