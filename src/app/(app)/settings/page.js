"use client";

import { useEffect, useState } from "react";
import TrafficLight from "@/components/TrafficLight";

const TONE_LABELS = {
  warm_and_gentle: "Warm & gentle",
  direct_and_clear: "Direct & clear",
  playful_and_light: "Playful & light",
  calm_and_neutral: "Calm & neutral",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [tone, setTone] = useState("warm_and_gentle");
  const [validTones, setValidTones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [connRes, toneRes] = await Promise.all([
        fetch("/api/connections"),
        fetch("/api/settings/tone"),
      ]);

      if (connRes.ok) {
        const data = await connRes.json();
        setConnections(data.connections || []);
        if (data.connections?.length > 0) {
          setSelectedConnection(data.connections[0].id);
        }
      }
      if (toneRes.ok) {
        const data = await toneRes.json();
        setTone(data.tonePreference);
        setValidTones(data.validTones || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedConnection) return;

    async function loadSettings() {
      const res = await fetch(`/api/settings/topics?connectionId=${selectedConnection}`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || []);
      }
    }
    loadSettings();
  }, [selectedConnection]);

  async function handleToggle(topicName, newLevel) {
    setSettings((prev) =>
      prev.map((s) => (s.topicName === topicName ? { ...s, comfortLevel: newLevel } : s))
    );

    await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: selectedConnection,
        topicName,
        comfortLevel: newLevel,
      }),
    });
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

      {connections.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm">
          <p>Connect with a partner to set topic boundaries.</p>
          <a href="/invite" className="font-medium underline">Invite your partner</a>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Topic boundaries</h2>
            <p className="text-sm text-slate-500 mt-1">
              Tap to cycle: <span className="text-emerald-600 font-medium">Open</span> →{" "}
              <span className="text-amber-500 font-medium">Gentle</span> →{" "}
              <span className="text-red-500 font-medium">Not Ready</span>
            </p>
          </div>

          {connections.length > 1 && (
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.partnerName}</option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-3 gap-3">
            {settings.map((setting) => (
              <TrafficLight
                key={setting.topicName}
                topicName={setting.topicName}
                label={setting.label}
                comfortLevel={setting.comfortLevel}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
