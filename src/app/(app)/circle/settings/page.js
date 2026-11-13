"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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

const RELATIONSHIP_LABELS = {
  spouse: "Spouse",
  partner: "Partner",
  friend: "Friend",
  sibling: "Sibling",
  parent: "Parent",
  child: "Child",
  coworker: "Coworker",
  roommate: "Roommate",
  other: "Other",
};

const COMFORT_STYLES = {
  green: { label: "Open", bg: "bg-emerald-500", text: "text-emerald-700", ring: "ring-emerald-100" },
  yellow: { label: "Gentle", bg: "bg-amber-400", text: "text-amber-700", ring: "ring-amber-100" },
  red: { label: "Avoid", bg: "bg-red-500", text: "text-red-700", ring: "ring-red-100" },
};

function TopicRow({ setting, onToggle, onSaveNote, onRemove }) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(setting.note || "");
  const [saving, setSaving] = useState(false);

  async function handleSaveNote() {
    setSaving(true);
    await onSaveNote(setting.topicName, noteDraft.trim());
    setSaving(false);
    setEditingNote(false);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm text-slate-800 flex-1 min-w-0 truncate">{setting.label}</p>
        {onRemove && (
          <button
            onClick={() => onRemove(setting.topicName)}
            aria-label={`Remove ${setting.label}`}
            className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {["green", "yellow", "red"].map((level) => {
          const style = COMFORT_STYLES[level];
          const active = setting.comfortLevel === level;
          return (
            <button
              key={level}
              onClick={() => onToggle(setting.topicName, level)}
              className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${
                active
                  ? `${style.bg} text-white`
                  : "bg-gray-50 text-slate-500 hover:bg-gray-100"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${active ? "bg-white" : style.bg}`} />
              {style.label}
            </button>
          );
        })}
      </div>
      {setting.comfortLevel !== "green" && (
        <div className="pt-1">
          {editingNote ? (
            <div className="space-y-1.5">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="E.g. specifically my mother-in-law, not siblings"
                rows={2}
                maxLength={200}
                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs resize-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleSaveNote}
                  disabled={saving}
                  className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setEditingNote(false); setNoteDraft(setting.note || ""); }}
                  className="text-xs text-slate-500 px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : setting.note ? (
            <button
              onClick={() => setEditingNote(true)}
              className="w-full text-left text-[11px] text-slate-500 italic px-2 py-1 bg-slate-50 rounded hover:bg-slate-100"
            >
              &ldquo;{setting.note}&rdquo; · edit
            </button>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="text-[11px] text-emerald-600 hover:underline"
            >
              + Add specifics (e.g. &ldquo;mother-in-law&rdquo;)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AITuningPage() {
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connectionId");

  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState("Your person");
  const [tone, setTone] = useState("warm_and_gentle");
  const [tonePrompt, setTonePrompt] = useState("");
  const [tonePromptDirty, setTonePromptDirty] = useState(false);
  const [tonePromptSaving, setTonePromptSaving] = useState(false);
  const [validTones, setValidTones] = useState([]);
  const [relationship, setRelationship] = useState("spouse");
  const [validRelationships, setValidRelationships] = useState(Object.keys(RELATIONSHIP_LABELS));
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
        const [toneRes, topicsData, partnerRes, relRes, circleRes] = await Promise.all([
          fetch(`/api/settings/tone?connectionId=${connectionId}`),
          fetchTopics(),
          fetch(`/api/partner?connectionId=${connectionId}`),
          fetch("/api/circle/relationship"),
          fetch("/api/circle"),
        ]);

        if (cancelled) return;

        if (toneRes.ok) {
          const data = await toneRes.json();
          setTone(data.tonePreference);
          setTonePrompt(data.tonePrompt || "");
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
        if (relRes.ok) {
          const data = await relRes.json();
          if (Array.isArray(data.validRelationships)) setValidRelationships(data.validRelationships);
        }
        if (circleRes.ok) {
          const data = await circleRes.json();
          const member = (data.members || []).find((m) => m.connectionId === connectionId);
          if (member?.relationshipType) setRelationship(member.relationshipType);
        }
      } catch {
        if (!cancelled) setError("load_failed");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [connectionId, fetchTopics]);

  async function handleRelationshipChange(newRel) {
    setRelationship(newRel);
    await fetch("/api/circle/relationship", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, relationshipType: newRel }),
    });
  }

  async function handleToneChange(newTone) {
    setTone(newTone);
    await fetch("/api/settings/tone", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tonePreference: newTone, connectionId }),
    });
  }

  async function handleTonePromptSave() {
    setTonePromptSaving(true);
    await fetch("/api/settings/tone", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tonePreference: tone, tonePrompt, connectionId }),
    });
    setTonePromptDirty(false);
    setTonePromptSaving(false);
  }

  async function handleToggle(topicName, newLevel) {
    const existing = topicSettings.find((s) => s.topicName === topicName);
    setTopicSettings((prev) =>
      prev.map((s) => (s.topicName === topicName ? { ...s, comfortLevel: newLevel } : s))
    );
    await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId,
        topicName,
        comfortLevel: newLevel,
        note: existing?.note || "",
      }),
    });
  }

  async function handleSaveNote(topicName, note) {
    const existing = topicSettings.find((s) => s.topicName === topicName);
    if (!existing) return;
    await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId,
        topicName,
        comfortLevel: existing.comfortLevel,
        note,
      }),
    });
    setTopicSettings((prev) =>
      prev.map((s) => (s.topicName === topicName ? { ...s, note } : s))
    );
  }

  async function handleAddCustom(e) {
    e.preventDefault();
    setCustomError(null);
    const res = await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, customLabel, comfortLevel: "yellow" }),
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
      body: JSON.stringify({ connectionId, topicName }),
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

      {/* Relationship */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Relationship</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-3">
            Tell the AI who {partnerName} is to you. A message to a sibling sounds different than one to a coworker.
          </p>
          <select
            value={relationship}
            onChange={(e) => handleRelationshipChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            {validRelationships.map((r) => (
              <option key={r} value={r}>{RELATIONSHIP_LABELS[r] || r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Tone I want to receive</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-xs text-slate-500">
            When {partnerName} sends a message, the AI rewrites it in this tone before you read it.
            For example with &quot;Warm &amp; gentle&quot;, &quot;we need to talk&quot; becomes
            &quot;Hey, can we chat when you have a moment?&quot;
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
          <div className="pt-2 border-t border-gray-100 space-y-1.5">
            <p className="text-xs font-medium text-slate-600">Extra instructions (optional)</p>
            <textarea
              value={tonePrompt}
              onChange={(e) => { setTonePrompt(e.target.value); setTonePromptDirty(true); }}
              placeholder="E.g. avoid work talk after 6pm, or soften anything about kids"
              rows={2}
              maxLength={200}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
            />
            {tonePromptDirty && (
              <button
                onClick={handleTonePromptSave}
                disabled={tonePromptSaving}
                className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {tonePromptSaving ? "Saving..." : "Save instructions"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Topic boundaries */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Topics you&apos;re comfortable receiving</h2>
        <p className="text-xs text-slate-500">
          For sensitive topics, you can add specifics — e.g. mark Family as <span className="text-amber-700 font-medium">Gentle</span> and add
          <em> &ldquo;specifically my mother-in-law&rdquo;</em> so the AI only softens messages about her, not all family.
        </p>

        <div className="space-y-2">
          {presets.map((setting) => (
            <TopicRow
              key={setting.topicName}
              setting={setting}
              onToggle={handleToggle}
              onSaveNote={handleSaveNote}
            />
          ))}
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-slate-800">Your own topics</h3>
          {customs.length > 0 && (
            <div className="space-y-2">
              {customs.map((setting) => (
                <TopicRow
                  key={setting.topicName}
                  setting={setting}
                  onToggle={handleToggle}
                  onSaveNote={handleSaveNote}
                  onRemove={handleRemoveCustom}
                />
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
