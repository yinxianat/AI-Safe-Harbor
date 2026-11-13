"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import { VisibilityPicker, VisibilityLabel } from "@/components/VisibilityPicker.js";
import { AudienceReview, TunePanel, useAudienceReview } from "@/components/AudienceReview.js";
import VoiceInput from "@/components/VoiceInput.js";

const MAX_PROMPT = 200;
const MAX_ANSWER = 2000;

export default function KnowMePage() {
  const { t } = useT();
  const [entries, setEntries] = useState(null);
  const [connections, setConnections] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [draftVisibility, setDraftVisibility] = useState([]);
  const [draftVariants, setDraftVariants] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The heading can name a topic too, so both fields are checked together —
  // matching what the server does on save.
  const { review, checking } = useAudienceReview(
    prompt.trim() || answer.trim() ? `${prompt}\n${answer}` : "",
    draftVisibility
  );

  function chooseVariant(connectionId, tuned) {
    setDraftVariants((prev) => {
      const next = { ...prev };
      if (tuned) next[connectionId] = tuned;
      else delete next[connectionId];
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [kmRes, connRes] = await Promise.all([
          fetch("/api/knowme"),
          fetch("/api/connections"),
        ]);
        if (cancelled) return;
        if (kmRes.ok) setEntries((await kmRes.json()).entries || []);
        else { setEntries([]); setError(t("knowme_load_failed")); }
        if (connRes.ok) setConnections((await connRes.json()).connections || []);
      } catch {
        if (!cancelled) { setEntries([]); setError(t("knowme_load_failed")); }
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!prompt.trim() || !answer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/knowme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          answer: answer.trim(),
          visibleTo: draftVisibility,
          variants: Object.keys(draftVariants).length > 0 ? draftVariants : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "blocked_entirely"
            ? t("review_blocked_all")
            : body.detail || t("knowme_save_failed")
        );
      } else {
        const data = await res.json();
        setEntries((prev) => [...(prev || []), data.entry]);
        setPrompt("");
        setAnswer("");
        setDraftVisibility([]);
        setDraftVariants({});
      }
    } catch {
      setError(t("network_error"));
    }
    setSaving(false);
  }

  async function handleUpdate(id, patch) {
    setError(null);
    try {
      const res = await fetch("/api/knowme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        setError(t("knowme_save_failed"));
        return false;
      }
      const data = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...data.entry } : e)));
      return true;
    } catch {
      setError(t("network_error"));
      return false;
    }
  }

  async function handleDelete(id) {
    setError(null);
    try {
      const res = await fetch("/api/knowme", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setError(t("knowme_delete_failed"));
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError(t("network_error"));
    }
  }

  if (entries === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link href="/me" className="text-sm text-emerald-600 font-medium">{t("knowme_back")}</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">{t("knowme_title")}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">{t("knowme_subtitle")}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
            {t("dismiss")}
          </button>
        </div>
      )}

      <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-3">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("knowme_prompt_placeholder")}
          maxLength={MAX_PROMPT}
          spellCheck
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t("knowme_answer_placeholder")}
          rows={4}
          maxLength={MAX_ANSWER}
          spellCheck
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex justify-end">
          <VoiceInput
            onTranscript={(spoken) => setAnswer((prev) => prev ? `${prev} ${spoken}` : spoken)}
            disabled={saving}
            className="p-2"
          />
        </div>
        <VisibilityPicker
          connections={connections}
          selected={draftVisibility}
          onChange={setDraftVisibility}
          hint={t("story_visible_edit")}
        />

        {answer.trim() && connections.length > 0 && (
          <>
            <AudienceReview review={review} checking={checking} />
            <TunePanel
              text={answer}
              visibleTo={draftVisibility}
              chosen={draftVariants}
              onChoose={chooseVariant}
              disabled={saving || review?.blockedEntirely}
            />
          </>
        )}

        <button
          type="submit"
          disabled={!prompt.trim() || !answer.trim() || saving || review?.blockedEntirely}
          className="w-full bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
        >
          {saving ? t("knowme_adding") : t("knowme_add")}
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t("knowme_empty")}</p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">{t("knowme_count", { count: entries.length })}</p>
          {entries.map((entry) => (
            <KnowMeCard
              key={entry.id}
              entry={entry}
              connections={connections}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KnowMeCard({ entry, connections, onUpdate, onDelete }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(entry.prompt);
  const [draftAnswer, setDraftAnswer] = useState(entry.answer);
  const [editingVis, setEditingVis] = useState(false);
  const [localVis, setLocalVis] = useState(entry.visibleTo || []);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draftPrompt.trim() || !draftAnswer.trim()) return;
    setBusy(true);
    const ok = await onUpdate(entry.id, {
      prompt: draftPrompt.trim(),
      answer: draftAnswer.trim(),
    });
    setBusy(false);
    if (ok) setEditing(false);
  }

  async function saveVis() {
    setBusy(true);
    const ok = await onUpdate(entry.id, { visibleTo: localVis });
    setBusy(false);
    if (ok) setEditingVis(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            maxLength={MAX_PROMPT}
            spellCheck
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <textarea
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.target.value)}
            rows={4}
            maxLength={MAX_ANSWER}
            spellCheck
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy || !draftPrompt.trim() || !draftAnswer.trim()}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {busy ? "…" : t("story_save")}
            </button>
            <button
              onClick={() => { setEditing(false); setDraftPrompt(entry.prompt); setDraftAnswer(entry.answer); }}
              className="text-xs text-slate-500 px-2"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-500">{entry.prompt}</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{entry.answer}</p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {connections.length > 0 ? (
              <VisibilityLabel
                connections={connections}
                visibleTo={entry.visibleTo}
                onEdit={() => { setLocalVis(entry.visibleTo || []); setEditingVis(!editingVis); }}
              />
            ) : <span />}
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setEditing(true)} className="text-xs text-emerald-600 font-medium">
                {t("story_edit")}
              </button>
              <button onClick={() => setConfirming(true)} className="text-xs text-red-500 font-medium">
                {t("story_delete")}
              </button>
            </div>
          </div>
        </>
      )}

      {confirming && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 space-y-2">
          <p className="text-xs text-red-700">{t("knowme_delete_confirm")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => onDelete(entry.id)}
              className="flex-1 text-xs font-medium bg-red-600 text-white py-1.5 rounded-lg"
            >
              {t("story_delete")}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-600 py-1.5 rounded-lg"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {editingVis && !editing && (
        <div className="pt-1 space-y-2 border-t border-gray-100">
          <VisibilityPicker
            connections={connections}
            selected={localVis}
            onChange={setLocalVis}
            hint={t("story_visible_edit")}
          />
          <div className="flex gap-2">
            <button onClick={saveVis} disabled={busy} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
              {busy ? "…" : t("story_save")}
            </button>
            <button onClick={() => setEditingVis(false)} className="text-xs text-slate-500 px-2">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
