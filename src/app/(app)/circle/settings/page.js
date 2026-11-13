"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";

const TONE_KEYS = {
  warm_and_gentle: "tone_warm_and_gentle",
  direct_and_clear: "tone_direct_and_clear",
  playful_and_light: "tone_playful_and_light",
  calm_and_neutral: "tone_calm_and_neutral",
  encouraging_and_supportive: "tone_encouraging_and_supportive",
  brief_and_to_the_point: "tone_brief_and_to_the_point",
  thoughtful_and_reflective: "tone_thoughtful_and_reflective",
  reassuring_and_patient: "tone_reassuring_and_patient",
};

const RELATIONSHIP_KEYS = {
  spouse: "rel_spouse",
  partner: "rel_partner",
  friend: "rel_friend",
  sibling: "rel_sibling",
  parent: "rel_parent",
  child: "rel_child",
  coworker: "rel_coworker",
  roommate: "rel_roommate",
  other: "rel_other",
};

const COMFORT_STYLES = {
  green: { labelKey: "comfort_open", bg: "bg-emerald-500" },
  yellow: { labelKey: "comfort_gentle", bg: "bg-amber-400" },
  red: { labelKey: "comfort_avoid", bg: "bg-red-500" },
};

function noteExampleKey(topicName) {
  // Fall back to the generic placeholder for custom topics (whose topicName
  // is not a known preset key, so the per-topic example would be missing).
  return `tuning_note_example_${topicName}`;
}

function TopicRow({ setting, onToggle, onSaveNote, onRemove }) {
  const { t } = useT();
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(setting.note || "");
  const [saving, setSaving] = useState(false);

  // Per-topic example makes the hint actually relevant; falls back to the
  // generic one when the key doesn't exist in the translation table.
  const exampleKey = noteExampleKey(setting.topicName);
  const placeholder = t(exampleKey) === exampleKey ? t("tuning_note_placeholder") : t(exampleKey);

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
            aria-label={t("tuning_remove_aria", { label: setting.label })}
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
              {t(style.labelKey)}
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
                placeholder={placeholder}
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
                  {saving ? t("saving") : t("save")}
                </button>
                <button
                  onClick={() => { setEditingNote(false); setNoteDraft(setting.note || ""); }}
                  className="text-xs text-slate-500 px-2"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : setting.note ? (
            <button
              onClick={() => setEditingNote(true)}
              className="w-full text-left text-[11px] text-slate-500 italic px-2 py-1 bg-slate-50 rounded hover:bg-slate-100"
            >
              &ldquo;{setting.note}&rdquo; · {t("tuning_note_edit")}
            </button>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="text-[11px] text-emerald-600 hover:underline"
            >
              {t("tuning_add_specifics")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AITuningPage() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connectionId");

  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState("");
  const [tone, setTone] = useState("warm_and_gentle");
  const [tonePrompt, setTonePrompt] = useState("");
  const [tonePromptDirty, setTonePromptDirty] = useState(false);
  const [tonePromptSaving, setTonePromptSaving] = useState(false);
  const [validTones, setValidTones] = useState([]);
  const [relationship, setRelationship] = useState("spouse");
  const [validRelationships, setValidRelationships] = useState(Object.keys(RELATIONSHIP_KEYS));
  const [topicSettings, setTopicSettings] = useState([]);
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customError, setCustomError] = useState(null);
  const [error, setError] = useState(null);

  const displayName = partnerName || t("circle_fallback_name");

  const fetchTopics = useCallback(async () => {
    if (!connectionId) return null;
    const res = await fetch(`/api/settings/topics?connectionId=${connectionId}`);
    if (!res.ok) return null;
    const data = await res.json();
    setSuggestedTopics(data.suggestedTopics || []);
    return data.settings || [];
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
            (data.partner?.username ? `@${data.partner.username}` : "")
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
      setCustomError(data.detail || t("tuning_could_not_add_topic"));
      return;
    }
    setCustomLabel("");
    const topics = await fetchTopics();
    if (topics) setTopicSettings(topics);
  }

  // One-click add for a non-core preset topic: it joins the preset list at
  // yellow so the user can refine it from there like any other preset.
  async function handleQuickAdd(topicName) {
    await fetch("/api/settings/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, topicName, comfortLevel: "yellow" }),
    });
    const topics = await fetchTopics();
    if (topics) setTopicSettings(topics);
  }

  // Removes any topic — preset or custom. A removed preset drops back into
  // the suggested-topics row so the user can add it again.
  async function handleRemove(topicName) {
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
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">{t("tuning_back_to_circle")}</Link>
        <p className="text-slate-600">{t("tuning_no_connection")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">{t("tuning_back_to_circle")}</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {t("tuning_load_failed")}
        </div>
      </div>
    );
  }

  const customs = topicSettings.filter((s) => s.isCustom);
  const presets = topicSettings.filter((s) => !s.isCustom);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">{t("tuning_back_to_circle")}</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">{t("tuning_title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("tuning_blurb", { name: displayName })}</p>
      </div>

      {/* Relationship */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("tuning_relationship_section")}</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-3">{t("tuning_relationship_hint", { name: displayName })}</p>
          <select
            value={relationship}
            onChange={(e) => handleRelationshipChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            {validRelationships.map((r) => (
              <option key={r} value={r}>{t(RELATIONSHIP_KEYS[r] || "rel_other")}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("tuning_tone_section")}</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-xs text-slate-500">{t("tuning_tone_hint", { name: displayName })}</p>
          <select
            value={tone}
            onChange={(e) => handleToneChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            {validTones.map((val) => (
              <option key={val} value={val}>{t(TONE_KEYS[val] || "tone_warm_and_gentle")}</option>
            ))}
          </select>
          <div className="pt-2 border-t border-gray-100 space-y-1.5">
            <p className="text-xs font-medium text-slate-600">{t("tuning_extra_instructions")}</p>
            <textarea
              value={tonePrompt}
              onChange={(e) => { setTonePrompt(e.target.value); setTonePromptDirty(true); }}
              placeholder={t("tuning_extra_placeholder")}
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
                {tonePromptSaving ? t("saving") : t("tuning_save_instructions")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Topic boundaries */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("tuning_topics_section")}</h2>
        <p className="text-xs text-slate-500">
          {t("tuning_topics_hint_1")}{" "}
          <span className="text-amber-700 font-medium">{t("comfort_gentle")}</span>
          {" "}{t("tuning_topics_hint_2")}
        </p>

        <div className="space-y-2">
          {presets.map((setting) => (
            <TopicRow
              key={setting.topicName}
              setting={setting}
              onToggle={handleToggle}
              onSaveNote={handleSaveNote}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-slate-800">{t("tuning_your_own_topics")}</h3>
          {customs.length > 0 && (
            <div className="space-y-2">
              {customs.map((setting) => (
                <TopicRow
                  key={setting.topicName}
                  setting={setting}
                  onToggle={handleToggle}
                  onSaveNote={handleSaveNote}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}

          {suggestedTopics.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500">{t("tuning_suggested_topics")}</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTopics.map((s) => (
                  <button
                    key={s.topicName}
                    onClick={() => handleQuickAdd(s.topicName)}
                    className="text-xs px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAddCustom} className="flex gap-2">
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={t("tuning_add_topic_placeholder")}
              maxLength={30}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
            />
            <button
              type="submit"
              disabled={!customLabel.trim()}
              className="bg-emerald-600 text-white text-sm font-medium px-4 rounded-lg disabled:opacity-50"
            >
              {t("tuning_add")}
            </button>
          </form>
          {customError && <p className="text-sm text-red-600">{customError}</p>}
        </div>
      </div>
    </div>
  );
}
