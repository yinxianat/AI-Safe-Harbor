"use client";

import { useEffect, useState, useCallback, useRef } from "react";

function ChatBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-md"
            : "bg-slate-100 text-slate-800 rounded-bl-md"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export default function PracticePadPage() {
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
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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
              className="text-sm text-indigo-600 font-medium"
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
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Practice Pad</h1>
        <p className="text-sm text-slate-500 mt-1">
          Rehearse tough conversations with an AI partner before sending for real.
          It is private — only you can see your practice sessions.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={startSession} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <p className="font-semibold text-slate-800">Start a new session</p>
        <p className="text-sm text-slate-500">
          What do you want to practice talking about?
        </p>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder='e.g. "Bringing up how I feel about the holiday plans"'
          maxLength={200}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={starting || !topic.trim()}
          className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl disabled:opacity-50"
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

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-sm text-indigo-700 font-medium">How it works</p>
        <ul className="text-sm text-indigo-600 mt-2 space-y-1 list-disc list-inside">
          <li>The AI plays your partner, responding naturally</li>
          <li>If you say something that might hurt, it gently points it out</li>
          <li>Practice as many times as you need — it is private</li>
          <li>When you feel ready, go to Compose to send for real</li>
        </ul>
      </div>
    </div>
  );
}
