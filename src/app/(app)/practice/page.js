"use client";

import { useEffect, useState, useCallback, useRef } from "react";

function ChatBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-emerald-600 text-white rounded-br-md"
            : "bg-slate-100 text-slate-800 rounded-bl-md"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export default function PracticePadPage() {
  const [mode, setMode] = useState("rehearse");
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/practice");
      if (res.ok) {
        return (await res.json()).sessions || [];
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSessions().then((data) => {
      if (!cancelled) {
        setSessions(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [loadSessions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function startSession(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.error || "Could not start the session. Please try again.");
        return;
      }

      setActiveSession(data.session);
      setTurns(data.session.turns || []);
      setTopic("");
      setSessions((prev) => [
        { id: data.session.id, topic: data.session.topic, createdAt: data.session.createdAt },
        ...prev,
      ]);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || !activeSession) return;
    setSending(true);
    setError(null);

    const userMessage = input.trim();
    setInput("");
    setTurns((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id, message: userMessage }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.error || "AI is temporarily unavailable. Try again in a moment.");
        return;
      }

      setTurns(data.turns);
    } catch {
      setError("Network error. Your message was not sent — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function openSession(sessionId) {
    setError(null);
    try {
      const res = await fetch(`/api/practice?id=${sessionId}`);
      if (!res.ok) {
        setError("Could not load that session.");
        return;
      }
      const data = await res.json();
      setActiveSession(data.session);
      setTurns(data.session.turns || []);
    } catch {
      setError("Network error loading the session.");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (activeSession) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)]">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <button
              onClick={() => { setActiveSession(null); setTurns([]); setError(null); }}
              className="text-sm text-emerald-600 font-medium"
            >
              ← Back
            </button>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Practicing: {activeSession.topic}
            </h2>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mt-2 text-sm">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {turns.map((turn, i) => (
            <ChatBubble key={i} role={turn.role} content={turn.content} />
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-slate-400">
                Thinking…
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-gray-100">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your practice message…"
            maxLength={2000}
            disabled={sending}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-emerald-600 text-white px-4 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Practice Pad</h1>
        <p className="text-sm text-slate-500 mt-1">
          Try things out before sending for real. Private — only you see this.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setMode("rehearse")}
          className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
            mode === "rehearse" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Rehearse
        </button>
        <button
          onClick={() => setMode("tune")}
          className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
            mode === "tune" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          Tune a draft
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
            Dismiss
          </button>
        </div>
      )}

      {mode === "rehearse" ? (
        <>
          <form onSubmit={startSession} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="font-semibold text-slate-800">Rehearse a conversation</p>
            <p className="text-sm text-slate-500">
              The AI plays your partner. Say something; see how they might react.
            </p>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder='e.g. "Bringing up how I feel about the holiday plans"'
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={starting || !topic.trim()}
              className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start Practicing"}
            </button>
          </form>

          {sessions.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Past sessions
              </h2>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s.id)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  <p className="font-medium text-slate-800">{s.topic}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <DraftTuner />
      )}

      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
        <p className="text-sm text-emerald-700 font-medium">How it works</p>
        <ul className="text-sm text-emerald-600 mt-2 space-y-1 list-disc list-inside">
          <li><strong>Rehearse</strong>: The AI plays your partner so you can try things out</li>
          <li><strong>Tune a draft</strong>: Paste a draft message or post; the AI rewrites it in the tone you want</li>
          <li>Both are private — only you see this</li>
        </ul>
      </div>
    </div>
  );
}

function DraftTuner() {
  const [connections, setConnections] = useState([]);
  const [connectionId, setConnectionId] = useState("");
  const [draft, setDraft] = useState("");
  const [tuning, setTuning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/connections");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setConnections(data.connections || []);
        }
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleTune(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setTuning(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/practice/tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, connectionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "Could not tune the draft right now.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    }
    setTuning(false);
  }

  async function handleCopy() {
    if (!result?.tuned) return;
    try {
      await navigator.clipboard.writeText(result.tuned);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may be unavailable */ }
  }

  return (
    <form onSubmit={handleTune} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <p className="font-semibold text-slate-800">Tune a draft</p>
      <p className="text-sm text-slate-500">
        Write a message or post. The AI will rewrite it using the tone preferences you (and the recipient) have set.
      </p>

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Tune for (optional)</label>
        <select
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
        >
          <option value="">General (no specific person)</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>{c.partnerName}</option>
          ))}
        </select>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste your draft here..."
        rows={5}
        maxLength={5000}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />

      <button
        type="submit"
        disabled={tuning || !draft.trim()}
        className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl disabled:opacity-50"
      >
        {tuning ? "Tuning…" : "Tune with AI"}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {result && result.held && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-amber-800">Message would be held</p>
          <p className="text-xs text-amber-700 mt-1">
            This draft touches a topic the recipient prefers not to discuss. Revise and try again, or send a different message.
          </p>
          {result.flagged && result.flagged.length > 0 && (
            <p className="text-xs text-amber-700 mt-2">Flagged: {result.flagged.map((f) => f.topic).join(", ")}</p>
          )}
        </div>
      )}

      {result && result.tuned && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-emerald-700 uppercase">AI version</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{result.tuned}</p>
          {result.flagged && result.flagged.length > 0 && (
            <p className="text-[11px] text-amber-600">Gently softened: {result.flagged.map((f) => f.topic).join(", ")}</p>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </form>
  );
}
