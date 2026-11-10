"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

const CATEGORY_LABELS = {
  about_me: "About Me",
  favorites: "Favorites",
  love_languages: "Love Languages",
  pet_peeves: "Pet Peeves",
  stories: "Stories",
};

const PROMPTS = {
  about_me: [
    "Something most people don't know about me",
    "What I need when I'm stressed",
    "How I like to be comforted",
    "My communication style",
  ],
  favorites: [
    "My comfort food",
    "A song that always lifts me up",
    "My favorite way to spend a weekend",
    "A movie or show I could rewatch forever",
  ],
  love_languages: [
    "What makes me feel most loved",
    "How I naturally show love",
    "A small thing that means a lot to me",
  ],
  pet_peeves: [
    "Something that frustrates me (that I wish I could explain calmly)",
    "A misunderstanding that keeps happening",
    "What I need when I'm annoyed",
  ],
  stories: [
    "A memory that shaped who I am",
    "Something funny that happened to us",
    "A moment I felt really understood",
  ],
};

function EntryCard({ entry, isOwner, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.answer);

  function save() {
    onEdit(entry.id, value);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
      <p className="text-sm font-medium text-slate-600">{entry.prompt}</p>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button onClick={save} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-slate-500">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-slate-800 whitespace-pre-wrap">{entry.answer}</p>
          {isOwner && (
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 font-medium">
                Edit
              </button>
              <button onClick={() => onDelete(entry.id)} className="text-xs text-red-500 font-medium">
                Remove
              </button>
              {!entry.isPublic && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Private</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function KnowMePage() {
  const searchParams = useSearchParams();
  const viewUserId = searchParams.get("userId");

  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("about_me");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [isOwner, setIsOwner] = useState(true);
  const [error, setError] = useState(null);

  const loadEntries = useCallback(async () => {
    const url = viewUserId ? `/api/knowme?userId=${viewUserId}` : "/api/knowme";
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return { entries: data.entries || [], categories: data.categories || [] };
      }
      if (res.status === 403) return { error: "You are not connected with this person." };
      return { error: "Could not load entries. Please try again." };
    } catch {
      return { error: "Network error. Check your connection and try again." };
    }
  }, [viewUserId]);

  const ownerView = !viewUserId;

  useEffect(() => {
    let cancelled = false;
    loadEntries().then((data) => {
      if (cancelled) return;
      if (data?.error) {
        setError(data.error);
      } else if (data) {
        setEntries(data.entries);
        setCategories(data.categories);
        setError(null);
      }
      setIsOwner(ownerView);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [viewUserId, loadEntries, ownerView]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newPrompt.trim() || !newAnswer.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/knowme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeCategory, prompt: newPrompt, answer: newAnswer }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [...prev, data.entry]);
        setNewPrompt("");
        setNewAnswer("");
        setAdding(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Could not save your entry. Please try again.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    }
  }

  async function handleEdit(id, answer) {
    setError(null);
    try {
      const res = await fetch("/api/knowme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, answer }),
      });
      if (res.ok) {
        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, answer } : e)));
      } else {
        setError("Could not save your edit. Please try again.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
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
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        setError("Could not remove that entry. Please try again.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    }
  }

  const filtered = entries.filter((e) => e.category === activeCategory);
  const suggestedPrompts = (PROMPTS[activeCategory] || []).filter(
    (p) => !entries.some((e) => e.prompt === p && e.category === activeCategory)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isOwner ? "Know Me" : "About Them"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isOwner
            ? "Share things about yourself so your person understands you better."
            : "Things they've shared to help you understand them."}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {(categories.length > 0 ? categories : Object.keys(CATEGORY_LABELS)).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap text-sm px-3 py-1.5 rounded-full border transition-colors ${
              activeCategory === cat
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-600 border-gray-200"
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && !adding && (
          <div className="text-center py-8 text-slate-400">
            <p className="text-lg mb-1">Nothing here yet</p>
            {isOwner && (
              <p className="text-sm">
                Share something about yourself — tap a suggestion below or add your own.
              </p>
            )}
          </div>
        )}

        {filtered.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            isOwner={isOwner}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {isOwner && !adding && suggestedPrompts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setNewPrompt(prompt); setAdding(true); }}
                className="text-sm px-3 py-1.5 rounded-full border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {isOwner && adding && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <input
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Question or heading…"
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            placeholder="Your answer…"
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newAnswer.trim()}
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewPrompt(""); setNewAnswer(""); }}
              className="text-sm text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isOwner && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-slate-500 text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          + Add your own
        </button>
      )}
    </div>
  );
}
