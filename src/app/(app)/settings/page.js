"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function SettingsPage() {
  const [settings, setSettings] = useState([]);
  const [connections, setConnections] = useState([]);
  // "" = defaults scope: boundaries that apply to everyone you connect with
  const [selectedConnection, setSelectedConnection] = useState("");
  const [tone, setTone] = useState("warm_and_gentle");
  const [validTones, setValidTones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customLabel, setCustomLabel] = useState("");
  const [customError, setCustomError] = useState(null);

  const fetchTopics = useCallback(async (connId) => {
    const url = connId
      ? `/api/settings/topics?connectionId=${connId}`
      : "/api/settings/topics";
    const res = await fetch(url);
    if (res.ok) return (await res.json()).settings || [];
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [connRes, toneRes] = await Promise.all([
        fetch("/api/connections"),
        fetch("/api/settings/tone"),
      ]);

      if (cancelled) return;
      let firstConn = "";
      if (connRes.ok) {
        const data = await connRes.json();
        setConnections(data.connections || []);
        if (data.connections?.length > 0) {
          firstConn = data.connections[0].id;
          setSelectedConnection(firstConn);
        }
      }
      if (toneRes.ok) {
        const data = await toneRes.json();
        setTone(data.tonePreference);
        setValidTones(data.validTones || []);
      }
      const topics = await fetchTopics(firstConn);
      if (!cancelled && topics) setSettings(topics);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchTopics]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const topics = await fetchTopics(selectedConnection);
      if (!cancelled && topics) setSettings(topics);
    })();
    return () => { cancelled = true; };
  }, [selectedConnection, fetchTopics]); // eslint-disable-line react-hooks/exhaustive-deps

  function scopeBody(extra) {
    return JSON.stringify(
      selectedConnection ? { connectionId: selectedConnection, ...extra } : extra
    );
  }

  async function handleToggle(topicName, newLevel) {
    setSettings((prev) =>
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
    const topics = await fetchTopics(selectedConnection);
    if (topics) setSettings(topics);
  }

  async function handleRemoveCustom(topicName) {
    await fetch("/api/settings/topics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: scopeBody({ topicName }),
    });
    const topics = await fetchTopics(selectedConnection);
    if (topics) setSettings(topics);
  }

  async function handleToneChange(newTone) {
    setTone(newTone);
    await fetch("/api/settings/tone", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tonePreference: newTone }),
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const customs = settings.filter((s) => s.isCustom);
  const presets = settings.filter((s) => !s.isCustom);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            How you want messages to arrive for you.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <label htmlFor="tone" className="block text-sm font-medium text-slate-800 mb-1">
            Preferred tone
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Messages sent to you are tuned to this tone.
          </p>
          <select
            id="tone"
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

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Topic boundaries</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tap to cycle: <span className="text-emerald-600 font-medium">Open</span> →{" "}
            <span className="text-amber-500 font-medium">Gentle</span> →{" "}
            <span className="text-red-500 font-medium">Not Ready</span>
          </p>
        </div>

        {connections.length === 0 ? (
          <p className="text-sm text-slate-500 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
            These are your defaults — they apply automatically to everyone who joins your
            circle, so set them before you connect.
          </p>
        ) : (
          <select
            value={selectedConnection}
            onChange={(e) => setSelectedConnection(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>With {c.partnerName}</option>
            ))}
            <option value="">Defaults for new people</option>
          </select>
        )}

        <div className="grid grid-cols-3 gap-3">
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
            <div className="grid grid-cols-3 gap-3">
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
              placeholder="Add a topic, e.g. “wedding planning”"
              maxLength={30}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
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
          <p className="text-xs text-slate-400">
            New topics start at Gentle. Messages mentioning them are softened; set Not Ready
            to hold them entirely.
          </p>
        </div>
      </div>
    </div>
  );
}
