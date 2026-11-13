"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import { VisibilityPicker, VisibilityLabel } from "@/components/VisibilityPicker.js";
import { AudienceReview, TunePanel, useAudienceReview } from "@/components/AudienceReview.js";
import VoiceInput from "@/components/VoiceInput.js";

const MAX_LENGTH = 1000;

export default function StoryPage() {
  const { t } = useT();
  const [posts, setPosts] = useState(null);
  const [connections, setConnections] = useState([]);
  const [draft, setDraft] = useState("");
  const [draftVisibility, setDraftVisibility] = useState([]);
  // connectionId -> approved rewrite. Only entries the author accepted.
  const [draftVariants, setDraftVariants] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { review, checking } = useAudienceReview(draft, draftVisibility);

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
        const [wallRes, connRes] = await Promise.all([
          fetch("/api/wall"),
          fetch("/api/connections"),
        ]);
        if (cancelled) return;
        if (wallRes.ok) setPosts((await wallRes.json()).posts || []);
        else { setPosts([]); setError(t("story_load_failed")); }
        if (connRes.ok) setConnections((await connRes.json()).connections || []);
      } catch {
        if (!cancelled) { setPosts([]); setError(t("story_load_failed")); }
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function handleAdd(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          visibleTo: draftVisibility,
          variants: Object.keys(draftVariants).length > 0 ? draftVariants : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "blocked_entirely"
            ? t("review_blocked_all")
            : body.detail || t("story_save_failed")
        );
      } else {
        const post = await res.json();
        setPosts((prev) => [post, ...(prev || [])]);
        setDraft("");
        setDraftVisibility([]);
        setDraftVariants({});
      }
    } catch {
      setError(t("network_error"));
    }
    setSaving(false);
  }

  async function handleUpdate(postId, patch) {
    setError(null);
    try {
      const res = await fetch("/api/wall", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, ...patch }),
      });
      if (!res.ok) {
        setError(t("story_save_failed"));
        return false;
      }
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      return true;
    } catch {
      setError(t("network_error"));
      return false;
    }
  }

  async function handleDelete(postId) {
    setError(null);
    try {
      const res = await fetch("/api/wall", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        setError(t("story_delete_failed"));
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      setError(t("network_error"));
    }
  }

  if (posts === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link href="/me" className="text-sm text-emerald-600 font-medium">{t("story_back")}</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">{t("story_title")}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">{t("story_subtitle")}</p>
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
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("story_placeholder")}
          rows={4}
          maxLength={MAX_LENGTH}
          spellCheck
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">{draft.length}/{MAX_LENGTH}</span>
          <VoiceInput
            onTranscript={(spoken) => setDraft((prev) => prev ? `${prev} ${spoken}` : spoken)}
            disabled={saving}
            className="p-2 shrink-0"
          />
        </div>

        <VisibilityPicker
          connections={connections}
          selected={draftVisibility}
          onChange={setDraftVisibility}
          hint={t("story_visible_edit")}
        />

        {draft.trim() && connections.length > 0 && (
          <>
            <AudienceReview review={review} checking={checking} />
            <TunePanel
              text={draft}
              visibleTo={draftVisibility}
              chosen={draftVariants}
              onChoose={chooseVariant}
              disabled={saving || review?.blockedEntirely}
            />
          </>
        )}

        <button
          type="submit"
          disabled={!draft.trim() || saving || review?.blockedEntirely}
          className="w-full bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
        >
          {saving ? t("story_adding") : t("story_add")}
        </button>
      </form>

      {posts.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t("story_empty")}</p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">{t("story_count", { count: posts.length })}</p>
          {posts.map((post) => (
            <StoryCard
              key={post.id}
              post={post}
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

function StoryCard({ post, connections, onUpdate, onDelete }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.text);
  const [editingVis, setEditingVis] = useState(false);
  const [localVis, setLocalVis] = useState(post.visibleTo || []);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveText() {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await onUpdate(post.id, { text: text.trim() });
    setBusy(false);
    if (ok) setEditing(false);
  }

  async function saveVis() {
    setBusy(true);
    const ok = await onUpdate(post.id, { visibleTo: localVis });
    setBusy(false);
    if (ok) setEditingVis(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-2">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={MAX_LENGTH}
            spellCheck
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-2">
            <button
              onClick={saveText}
              disabled={busy || !text.trim()}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {busy ? "…" : t("story_save")}
            </button>
            <button
              onClick={() => { setEditing(false); setText(post.text); }}
              className="text-xs text-slate-500 px-2"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{post.text}</p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-slate-400 shrink-0">
                {new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              {connections.length > 0 && (
                <>
                  <span className="text-[10px] text-slate-300">·</span>
                  <VisibilityLabel
                    connections={connections}
                    visibleTo={post.visibleTo}
                    onEdit={() => { setLocalVis(post.visibleTo || []); setEditingVis(!editingVis); }}
                  />
                </>
              )}
            </div>
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
          <p className="text-xs text-red-700">{t("story_delete_confirm")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => onDelete(post.id)}
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
