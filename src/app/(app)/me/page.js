"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MOOD_OPTIONS = [
  { key: "calm", dot: "bg-blue-400", label: "Calm" },
  { key: "happy", dot: "bg-emerald-400", label: "Happy" },
  { key: "energetic", dot: "bg-orange-400", label: "Energetic" },
  { key: "low", dot: "bg-slate-400", label: "Low" },
  { key: "neutral", dot: "bg-violet-400", label: "Neutral" },
];

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

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

export default function MePage() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status
  const [statusText, setStatusText] = useState("");
  const [statusMood, setStatusMood] = useState("neutral");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusDirty, setStatusDirty] = useState(false);

  // Wall
  const [wallPosts, setWallPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [newPostMood, setNewPostMood] = useState(null);
  const [postSaving, setPostSaving] = useState(false);

  // Know Me
  const [knowMeEntries, setKnowMeEntries] = useState([]);
  const [activeCategory, setActiveCategory] = useState("about_me");
  const [adding, setAdding] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  // Wall expansion
  const [wallExpanded, setWallExpanded] = useState(false);

  // Profile editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, knowMeRes, wallRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/knowme"),
          fetch("/api/wall"),
        ]);

        if (cancelled) return;

        if (meRes.ok) {
          const me = await meRes.json();
          setProfile(me);
          setNameInput(me.displayName || "");
          setStatusText(me.statusText || "");
          setStatusMood(me.statusMood || "neutral");
        }
        if (knowMeRes.ok) {
          const data = await knowMeRes.json();
          setKnowMeEntries(data.entries || []);
        }
        if (wallRes.ok) {
          const data = await wallRes.json();
          setWallPosts(data.posts || []);
        }
      } catch {
        if (!cancelled) setError("Could not load your profile.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Status handlers ---
  async function handleSaveStatus() {
    setStatusSaving(true);
    try {
      await fetch("/api/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusText, statusMood }),
      });
      setStatusDirty(false);
    } catch { /* ignore */ }
    setStatusSaving(false);
  }

  // --- Wall handlers ---
  async function handleNewPost(e) {
    e.preventDefault();
    if (!newPost.trim()) return;
    setPostSaving(true);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newPost, mood: newPostMood }),
      });
      if (res.ok) {
        const post = await res.json();
        setWallPosts((prev) => [post, ...prev]);
        setNewPost("");
        setNewPostMood(null);
      }
    } catch { /* ignore */ }
    setPostSaving(false);
  }

  async function handleDeletePost(postId) {
    try {
      const res = await fetch("/api/wall", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) setWallPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch { /* ignore */ }
  }

  // --- Know Me handlers ---
  async function handleAddEntry(e) {
    e.preventDefault();
    if (!newPrompt.trim() || !newAnswer.trim()) return;
    try {
      const res = await fetch("/api/knowme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: activeCategory, prompt: newPrompt, answer: newAnswer }),
      });
      if (res.ok) {
        const data = await res.json();
        setKnowMeEntries((prev) => [...prev, data.entry]);
        setNewPrompt("");
        setNewAnswer("");
        setAdding(false);
      }
    } catch { /* ignore */ }
  }

  async function handleEditEntry(id, answer) {
    try {
      const res = await fetch("/api/knowme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, answer }),
      });
      if (res.ok) {
        setKnowMeEntries((prev) => prev.map((e) => (e.id === id ? { ...e, answer } : e)));
      }
    } catch { /* ignore */ }
  }

  async function handleDeleteEntry(id) {
    try {
      const res = await fetch("/api/knowme", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setKnowMeEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch { /* ignore */ }
  }

  // --- Profile handlers ---
  async function handleSaveName() {
    setNameSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setEditingName(false);
      }
    } catch { /* ignore */ }
    setNameSaving(false);
  }

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const filteredEntries = knowMeEntries.filter((e) => e.category === activeCategory);
  const visiblePosts = wallExpanded ? wallPosts : wallPosts.slice(0, 2);
  const suggestedPrompts = (PROMPTS[activeCategory] || []).filter(
    (p) => !knowMeEntries.some((e) => e.prompt === p && e.category === activeCategory)
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Me</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">Dismiss</button>
        </div>
      )}

      {/* --- Status --- */}
      <Section title="Your status">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <input
            value={statusText}
            onChange={(e) => { setStatusText(e.target.value); setStatusDirty(true); }}
            placeholder="What's on your mind right now?"
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.key}
                onClick={() => { setStatusMood(m.key); setStatusDirty(true); }}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  statusMood === m.key
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "border-gray-200 text-slate-500 hover:border-gray-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                {m.label}
              </button>
            ))}
          </div>
          {statusDirty && (
            <button
              onClick={handleSaveStatus}
              disabled={statusSaving}
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {statusSaving ? "Saving…" : "Update status"}
            </button>
          )}
        </div>
      </Section>

      {/* --- Wall --- */}
      <Section title="Your wall">
        <form onSubmit={handleNewPost} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Share what's on your mind — your person will see this…"
            rows={2}
            maxLength={280}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setNewPostMood(newPostMood === m.key ? null : m.key)}
                  className={`w-6 h-6 rounded-full ${m.dot} ${
                    newPostMood === m.key ? "ring-2 ring-indigo-400 ring-offset-1" : "opacity-40 hover:opacity-70"
                  } transition-opacity`}
                  title={m.label}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={!newPost.trim() || postSaving}
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {postSaving ? "Posting…" : "Post"}
            </button>
          </div>
        </form>

        {visiblePosts.length > 0 && (
          <div className="space-y-2">
            {visiblePosts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 group">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">
                    {new Date(post.createdAt).toLocaleDateString(undefined, {
                      month: "short", day: "numeric",
                    })}
                  </span>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {wallPosts.length > 2 && (
          <button
            onClick={() => setWallExpanded(!wallExpanded)}
            className="text-sm text-indigo-600 font-medium"
          >
            {wallExpanded ? "Show less" : `View all ${wallPosts.length} posts`}
          </button>
        )}
      </Section>

      {/* --- Know Me --- */}
      <Section title="Know Me">
        <p className="text-sm text-slate-500">
          Share things about yourself so your person understands you better.
        </p>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {Object.keys(CATEGORY_LABELS).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap text-sm px-3 py-1.5 rounded-full border transition-colors ${
                activeCategory === cat
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-gray-200"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredEntries.length === 0 && !adding && (
            <div className="text-center py-6 text-slate-400">
              <p>Nothing here yet — tap a suggestion or add your own.</p>
            </div>
          )}

          {filteredEntries.map((entry) => (
            <KnowMeCard key={entry.id} entry={entry} onEdit={handleEditEntry} onDelete={handleDeleteEntry} />
          ))}
        </div>

        {!adding && suggestedPrompts.length > 0 && (
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
        )}

        {adding && (
          <form onSubmit={handleAddEntry} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
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
              <button type="submit" disabled={!newAnswer.trim()} className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={() => { setAdding(false); setNewPrompt(""); setNewAnswer(""); }} className="text-sm text-slate-500">
                Cancel
              </button>
            </div>
          </form>
        )}

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-slate-500 text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            + Add your own
          </button>
        )}
      </Section>

      {/* --- Profile --- */}
      {profile && (
        <Section title="Profile">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500">Display name</p>
              {editingName ? (
                <div className="flex gap-2 mt-1">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={50}
                    className="px-2 py-1 rounded-lg border border-gray-200 text-sm flex-1"
                    autoFocus
                  />
                  <button onClick={handleSaveName} disabled={nameSaving} className="text-sm font-medium text-indigo-600 disabled:opacity-50">
                    {nameSaving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => { setEditingName(false); setNameInput(profile.displayName || ""); }} className="text-sm text-slate-400">
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-800">
                  {profile.displayName || <span className="text-slate-400 italic">Not set</span>}
                  <button onClick={() => setEditingName(true)} className="ml-2 text-xs text-indigo-600 underline">Edit</button>
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Username</p>
              <p className="text-sm font-medium text-slate-800">
                {profile.username ? `@${profile.username}` : <span className="text-slate-400 italic">Not claimed</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm text-slate-600">{profile.email}</p>
            </div>
          </div>

        </Section>
      )}

      <div className="pt-4 border-t border-gray-100">
        <button
          onClick={handleSignOut}
          className="w-full py-3 text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function KnowMeCard({ entry, onEdit, onDelete }) {
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
            <button onClick={save} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg">Save</button>
            <button onClick={() => setEditing(false)} className="text-sm text-slate-500">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-slate-800 whitespace-pre-wrap">{entry.answer}</p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 font-medium">Edit</button>
            <button onClick={() => onDelete(entry.id)} className="text-xs text-red-500 font-medium">Remove</button>
          </div>
        </>
      )}
    </div>
  );
}
