"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MOOD_OPTIONS = ["calm", "happy", "energetic", "low", "neutral"];

const CATEGORY_LABELS = {
  about_me: "About Me",
  favorites: "Favorites",
  love_languages: "Love Languages",
  pet_peeves: "Pet Peeves",
  stories: "Stories",
};

const CATEGORY_EXAMPLES = {
  about_me: "e.g. What I need when I'm stressed, How I like to be comforted",
  favorites: "e.g. My comfort food, A song that lifts me up",
  love_languages: "e.g. What makes me feel most loved",
  pet_peeves: "e.g. A misunderstanding that keeps happening",
  stories: "e.g. A memory that shaped who I am",
};

function VisibilityPicker({ connections, selected, onChange }) {
  if (connections.length === 0) return null;

  const isEveryone = selected.length === 0;

  function toggle(connId) {
    if (selected.includes(connId)) {
      onChange(selected.filter((id) => id !== connId));
    } else {
      onChange([...selected, connId]);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-500">Visible to:</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isEveryone
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-slate-500 border-gray-200"
          }`}
        >
          Everyone
        </button>
        {connections.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selected.includes(c.id)
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-500 border-gray-200"
            }`}
          >
            {c.partnerName}
          </button>
        ))}
      </div>
    </div>
  );
}

function VisibilityLabel({ connections, visibleTo, onEdit }) {
  if (!visibleTo || visibleTo.length === 0) {
    return (
      <button onClick={onEdit} className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
        Everyone
      </button>
    );
  }

  const names = visibleTo
    .map((id) => connections.find((c) => c.id === id)?.partnerName)
    .filter(Boolean);

  return (
    <button onClick={onEdit} className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
      {names.length > 0 ? names.join(", ") : "Limited"}
    </button>
  );
}

export default function MePage() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusText, setStatusText] = useState("");
  const [statusMood, setStatusMood] = useState("neutral");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusDirty, setStatusDirty] = useState(false);

  const [wallPosts, setWallPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [newPostVisibility, setNewPostVisibility] = useState([]);
  const [postSaving, setPostSaving] = useState(false);
  const [wallExpanded, setWallExpanded] = useState(false);

  const [knowMeEntries, setKnowMeEntries] = useState([]);
  const [activeCategory, setActiveCategory] = useState("about_me");
  const [adding, setAdding] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newEntryVisibility, setNewEntryVisibility] = useState([]);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const [connections, setConnections] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, knowMeRes, wallRes, connRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/knowme"),
          fetch("/api/wall"),
          fetch("/api/connections"),
        ]);
        if (cancelled) return;
        if (meRes.ok) {
          const me = await meRes.json();
          setProfile(me);
          setNameInput(me.displayName || "");
          setStatusText(me.statusText || "");
          setStatusMood(me.statusMood || "neutral");
        }
        if (knowMeRes.ok) setKnowMeEntries((await knowMeRes.json()).entries || []);
        if (wallRes.ok) setWallPosts((await wallRes.json()).posts || []);
        if (connRes.ok) setConnections((await connRes.json()).connections || []);
      } catch {
        if (!cancelled) setError("Could not load your profile.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

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

  async function handleNewPost(e) {
    e.preventDefault();
    if (!newPost.trim()) return;
    setPostSaving(true);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newPost, visibleTo: newPostVisibility }),
      });
      if (res.ok) {
        const post = await res.json();
        setWallPosts((prev) => [post, ...prev]);
        setNewPost("");
        setNewPostVisibility([]);
      }
    } catch { /* ignore */ }
    setPostSaving(false);
  }

  async function handleUpdatePostVisibility(postId, visibleTo) {
    try {
      const res = await fetch("/api/wall", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, visibleTo }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWallPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      }
    } catch { /* ignore */ }
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

  async function handleAddEntry(e) {
    e.preventDefault();
    if (!newPrompt.trim() || !newAnswer.trim()) return;
    try {
      const res = await fetch("/api/knowme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeCategory,
          prompt: newPrompt,
          answer: newAnswer,
          visibleTo: newEntryVisibility,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setKnowMeEntries((prev) => [...prev, data.entry]);
        setNewPrompt("");
        setNewAnswer("");
        setNewEntryVisibility([]);
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
      if (res.ok) setKnowMeEntries((prev) => prev.map((e) => (e.id === id ? { ...e, answer } : e)));
    } catch { /* ignore */ }
  }

  async function handleUpdateEntryVisibility(id, visibleTo) {
    try {
      const res = await fetch("/api/knowme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visibleTo }),
      });
      if (res.ok) {
        setKnowMeEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, visibleTo } : e))
        );
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
      if (res.ok) setKnowMeEntries((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
  }

  async function handleSaveName() {
    setNameSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameInput.trim() }),
      });
      if (res.ok) { setProfile(await res.json()); setEditingName(false); }
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
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const filteredEntries = knowMeEntries.filter((e) => e.category === activeCategory);
  const visiblePosts = wallExpanded ? wallPosts : wallPosts.slice(0, 2);

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">Dismiss</button>
        </div>
      )}

      {/* --- Header: Name + Username --- */}
      <div className="flex items-center justify-between">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                className="px-2 py-1 rounded-lg border border-gray-200 text-lg font-bold w-40"
                autoFocus
              />
              <button onClick={handleSaveName} disabled={nameSaving} className="text-sm font-medium text-emerald-600">
                {nameSaving ? "..." : "Save"}
              </button>
              <button onClick={() => { setEditingName(false); setNameInput(profile?.displayName || ""); }} className="text-sm text-slate-400">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {profile?.displayName || "Me"}
              </h1>
              <button onClick={() => setEditingName(true)} className="text-xs text-emerald-600">Edit</button>
            </div>
          )}
          {profile?.username && (
            <p className="text-sm text-slate-500">@{profile.username}</p>
          )}
          {profile?.email && (
            <p className="text-xs text-slate-400">{profile.email}</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-red-500 font-medium"
        >
          Sign out
        </button>
      </div>

      {/* --- Status (compact) --- */}
      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
        <input
          value={statusText}
          onChange={(e) => { setStatusText(e.target.value); setStatusDirty(true); }}
          placeholder="How are you feeling? Calm, happy, energetic, low, neutral..."
          maxLength={200}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => { setStatusMood(m); setStatusDirty(true); }}
                className={`text-xs px-2 py-1 rounded-full transition-colors ${
                  statusMood === m
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-slate-500"
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {statusDirty && (
            <button
              onClick={handleSaveStatus}
              disabled={statusSaving}
              className="bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {statusSaving ? "..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* --- Wall (compact) --- */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Wall</p>
        <form onSubmit={handleNewPost} className="space-y-2">
          <div className="flex gap-2">
            <input
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Share something with your person..."
              maxLength={280}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!newPost.trim() || postSaving}
              className="bg-emerald-600 text-white text-xs font-medium px-3 rounded-lg disabled:opacity-50"
            >
              {postSaving ? "..." : "Post"}
            </button>
          </div>
          {connections.length > 1 && (
            <VisibilityPicker
              connections={connections}
              selected={newPostVisibility}
              onChange={setNewPostVisibility}
            />
          )}
        </form>

        {visiblePosts.map((post) => (
          <WallPostCard
            key={post.id}
            post={post}
            connections={connections}
            onDelete={handleDeletePost}
            onUpdateVisibility={handleUpdatePostVisibility}
          />
        ))}
        {wallPosts.length > 2 && (
          <button
            onClick={() => setWallExpanded(!wallExpanded)}
            className="text-xs text-emerald-600 font-medium"
          >
            {wallExpanded ? "Show less" : `View all ${wallPosts.length} posts`}
          </button>
        )}
      </div>

      {/* --- Know Me (compact) --- */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Know Me</p>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
          {Object.keys(CATEGORY_LABELS).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeCategory === cat
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-500 border-gray-200"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {filteredEntries.length === 0 && !adding && (
          <p className="text-xs text-slate-400 py-2">
            {CATEGORY_EXAMPLES[activeCategory] || "Add something about yourself."}
          </p>
        )}

        {filteredEntries.map((entry) => (
          <KnowMeCard
            key={entry.id}
            entry={entry}
            connections={connections}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
            onUpdateVisibility={handleUpdateEntryVisibility}
          />
        ))}

        {adding ? (
          <form onSubmit={handleAddEntry} className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
            <input
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Topic or question..."
              maxLength={200}
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Your answer..."
              rows={2}
              maxLength={2000}
              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {connections.length > 1 && (
              <VisibilityPicker
                connections={connections}
                selected={newEntryVisibility}
                onChange={setNewEntryVisibility}
              />
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={!newAnswer.trim()} className="bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">Save</button>
              <button type="button" onClick={() => { setAdding(false); setNewPrompt(""); setNewAnswer(""); setNewEntryVisibility([]); }} className="text-xs text-slate-500">Cancel</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-2 rounded-lg border border-dashed border-gray-200 text-slate-400 text-xs font-medium hover:border-emerald-300 hover:text-emerald-600 transition-colors"
          >
            + Add entry
          </button>
        )}
      </div>

      {/* --- Session Duration --- */}
      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Session Duration</p>
        <p className="text-[10px] text-slate-400">How long before you need to sign in again.</p>
        <div className="flex gap-1.5">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={async () => {
                await fetch("/api/auth/me", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sessionDays: d }),
                });
                setProfile((p) => ({ ...p, sessionDays: d }));
              }}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                (profile?.sessionDays || 30) === d
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-500 border-gray-200"
              }`}
            >
              {d === 7 ? "1 week" : d === 14 ? "2 weeks" : d === 30 ? "1 month" : "3 months"}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">Takes effect on your next sign-in.</p>
      </div>
    </div>
  );
}

function WallPostCard({ post, connections, onDelete, onUpdateVisibility }) {
  const [editingVis, setEditingVis] = useState(false);
  const [localVis, setLocalVis] = useState(post.visibleTo || []);

  function handleSaveVis() {
    onUpdateVisibility(post.id, localVis);
    setEditingVis(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 space-y-1 group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.text}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400">
              {new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            {connections.length > 1 && (
              <>
                <span className="text-xs text-slate-300">·</span>
                <VisibilityLabel
                  connections={connections}
                  visibleTo={post.visibleTo}
                  onEdit={() => { setLocalVis(post.visibleTo || []); setEditingVis(!editingVis); }}
                />
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(post.id)}
          className="text-xs text-red-400 opacity-0 group-hover:opacity-100 shrink-0 mt-1"
        >
          Delete
        </button>
      </div>
      {editingVis && (
        <div className="pt-1 space-y-2">
          <VisibilityPicker
            connections={connections}
            selected={localVis}
            onChange={setLocalVis}
          />
          <div className="flex gap-2">
            <button onClick={handleSaveVis} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">Save</button>
            <button onClick={() => setEditingVis(false)} className="text-xs text-slate-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowMeCard({ entry, connections, onEdit, onDelete, onUpdateVisibility }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.answer);
  const [editingVis, setEditingVis] = useState(false);
  const [localVis, setLocalVis] = useState(entry.visibleTo || []);

  function handleSaveVis() {
    onUpdateVisibility(entry.id, localVis);
    setEditingVis(false);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 space-y-1">
      <p className="text-xs font-medium text-slate-500">{entry.prompt}</p>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-2">
            <button onClick={() => { onEdit(entry.id, value); setEditing(false); }} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-slate-500">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{entry.answer}</p>
            {connections.length > 1 && (
              <div className="mt-0.5">
                <VisibilityLabel
                  connections={connections}
                  visibleTo={entry.visibleTo}
                  onEdit={() => { setLocalVis(entry.visibleTo || []); setEditingVis(!editingVis); }}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs text-emerald-600">Edit</button>
            <button onClick={() => onDelete(entry.id)} className="text-xs text-red-400">Del</button>
          </div>
        </div>
      )}
      {editingVis && !editing && (
        <div className="pt-1 space-y-2">
          <VisibilityPicker
            connections={connections}
            selected={localVis}
            onChange={setLocalVis}
          />
          <div className="flex gap-2">
            <button onClick={handleSaveVis} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">Save</button>
            <button onClick={() => setEditingVis(false)} className="text-xs text-slate-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
