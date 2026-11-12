"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TrafficLight from "@/components/TrafficLight";

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

export default function GuardianSettingsPage() {
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connectionId");

  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState("Your person");
  const [tone, setTone] = useState("warm_and_gentle");
  const [validTones, setValidTones] = useState([]);
  const [topicSettings, setTopicSettings] = useState([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customError, setCustomError] = useState(null);
  const [error, setError] = useState(null);

  const fetchTopics = useCallback(async () => {
    if (!connectionId) return null;
    const res = await fetch(`/api/settings/topics?connectionId=${connectionId}`);
    if (res.ok) return (await res.json()).settings || [];
    return null;
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId) {
      setError("no_connection");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [toneRes, topicsData, partnerRes] = await Promise.all([
          fetch("/api/settings/tone"),
          fetchTopics(),
          fetch(`/api/partner?connectionId=${connectionId}`),
        ]);

        if (cancelled) return;

        if (toneRes.ok) {
          const data = await toneRes.json();
          setTone(data.tonePreference);
          setValidTones(data.validTones || []);
        }
        if (topicsData) setTopicSettings(topicsData);
        if (partnerRes.ok) {
          const data = await partnerRes.json();
          setPartnerName(
            data.partner?.displayName ||
            (data.partner?.username ? `@${data.partner.username}` : "Your person")
          );
        }
      } catch {
        if (!cancelled) setError("load_failed");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [connectionId, fetchTopics]);

  async function handleToneChange(newTone) {
    setTone(newTone);
    await fetch("/api/settings/tone", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tonePreference: newTone }),
    });
  }

  function scopeBody(extra) {
    return JSON.stringify({ connectionId, ...extra });
  }

  async function handleToggle(topicName, newLevel) {
    setTopicSettings((prev) =>
      prev.map((s) => (s.topicName === topicName ? { ...s, comfortLevel: newLevel } : s))
    );
    await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: scopeBody({ topicName, comfortLevel: newLevel }),
    });
  }

  async function handleAddCustom(e) {
    e.preventDefault();
    setCustomError(null);
    const res = await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: scopeBody({ customLabel, comfortLevel: "yellow" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCustomError(data.detail || "Could not add that topic.");
      return;
    }
    setCustomLabel("");
    const topics = await fetchTopics();
    if (topics) setTopicSettings(topics);
  }

  async function handleRemoveCustom(topicName) {
    await fetch("/api/settings/topics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: scopeBody({ topicName }),
    });
    const topics = await fetchTopics();
    if (topics) setTopicSettings(topics);
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
      <div className="space-y-4">
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">← Back to Circle</Link>
        <p className="text-slate-600">No connection specified.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">← Back to Circle</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          Could not load settings.
        </div>
      </div>
    );
  }

  const customs = topicSettings.filter((s) => s.isCustom);
  const presets = topicSettings.filter((s) => !s.isCustom);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">← Back to Circle</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">AI Tuning</h1>
        <p className="text-sm text-slate-500 mt-1">
          Control how you receive messages from {partnerName}. The AI adjusts their messages before they reach you.
        </p>
      </div>

      {/* Tone */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Rephrase their messages as</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-3">
            {partnerName}&apos;s messages will be rephrased in this tone before you see them.
          </p>
          <select
            value={tone}
            onChange={(e) => handleToneChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            {validTones.map((t) => (
              <option key={t} value={t}>{TONE_LABELS[t] || t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Topic boundaries */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Topics you&apos;re comfortable receiving</h2>
        <p className="text-xs text-slate-500">
          When {partnerName} sends a message about one of these topics:
          Red = held for your review. Yellow = softened before delivery. Green = comes through normally.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {presets.map((setting) => (
            <TrafficLight
              key={setting.topicName}
              topicName={setting.topicName}
              label={setting.label}
              comfortLevel={setting.comfortLevel}
              onToggle={handleToggle}
            />
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Your own topics</h3>
          {customs.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {customs.map((setting) => (
                <div key={setting.topicName} className="relative">
                  <TrafficLight
                    topicName={setting.topicName}
                    label={setting.label}
                    comfortLevel={setting.comfortLevel}
                    onToggle={handleToggle}
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
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
            />
            <button
              type="submit"
              disabled={!customLabel.trim()}
              className="bg-emerald-600 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {customError && <p className="text-sm text-red-600">{customError}</p>}
        </div>
      </div>
    </div>
  );
}
