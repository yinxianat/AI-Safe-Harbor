"use client";

import { useState, useEffect, useMemo } from "react";

function TopicWarnings({ hints, text }) {
  const detected = useMemo(() => {
    if (!text.trim() || hints.length === 0) return [];
    const lower = text.toLowerCase();
    return hints.filter((h) =>
      h.keywords.some((kw) => lower.includes(kw))
    );
  }, [hints, text]);

  if (detected.length === 0 && text.trim().length > 0 && hints.length > 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        No boundary topics detected — looks good to send
      </div>
    );
  }

  if (detected.length === 0) return null;

  const red = detected.filter((d) => d.level === "red");
  const yellow = detected.filter((d) => d.level === "yellow");

  return (
    <div className="space-y-2">
      {red.map((t) => (
        <div key={t.topicName} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500 mt-0.5 shrink-0" />
          <span><strong>{t.label}</strong> — your person is not ready for this topic. This message will be held.</span>
        </div>
      ))}
      {yellow.map((t) => (
        <div key={t.topicName} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 mt-0.5 shrink-0" />
          <span><strong>{t.label}</strong> — marked gentle. AI will soften your tone on this topic.</span>
        </div>
      ))}
    </div>
  );
}

export default function ComposePage() {
  const [rawMessage, setRawMessage] = useState("");
  const [rephrased, setRephrased] = useState(null);
  const [messageId, setMessageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [held, setHeld] = useState(null);
  const [sent, setSent] = useState(false);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [error, setError] = useState(null);
  const [topicHints, setTopicHints] = useState([]);
  const [topicVerdict, setTopicVerdict] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const connRes = await fetch("/api/connections");
        if (cancelled) return;
        if (connRes.ok) {
          const data = await connRes.json();
          setConnections(data.connections || []);
          if (data.connections?.length > 0) {
            setSelectedConnection(data.connections[0].id);
          }
        } else {
          setError("Could not load your connections. Please refresh the page.");
        }
      } catch {
        if (!cancelled) setError("Network error. Check your connection and refresh.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedConnection) {
      requestAnimationFrame(() => setTopicHints([]));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/compose/topic-hints?connectionId=${selectedConnection}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setTopicHints(data.hints || []);
        }
      } catch {
        // hints are optional
      }
    })();
    return () => { cancelled = true; };
  }, [selectedConnection]);

  async function handleTune() {
    if (!rawMessage.trim() || !selectedConnection) return;
    setLoading(true);
    setHeld(null);
    setRephrased(null);
    setSent(false);
    setError(null);
    setTopicVerdict(null);

    try {
      const res = await fetch("/api/messages/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection,
          contentRaw: rawMessage,
        }),
      });

      if (!res.ok && res.status >= 500) {
        setError("Server error while tuning your message. Please try again.");
        return;
      }

      const data = await res.json();

      if (data.held) {
        setHeld(data);
      } else {
        setRephrased(data.rephrased);
        setMessageId(data.messageId);
        setTopicVerdict(data.topicVerdict || null);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(version) {
    if (!messageId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, versionSent: version }),
      });

      if (res.ok) {
        setSent(true);
        setRawMessage("");
        setRephrased(null);
        setMessageId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Could not send the message. Please try again.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setRephrased(null);
    setMessageId(null);
    setHeld(null);
    setSent(false);
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Compose</h1>
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-6 text-center">
          <p className="font-medium text-lg mb-1">Message Sent</p>
          <p className="text-sm">Your message has been delivered safely.</p>
        </div>
        <button
          onClick={handleReset}
          className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Compose</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">
            Dismiss
          </button>
        </div>
      )}

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

      {connections.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm">
          <p className="font-medium">No one in your circle yet</p>
          <p className="mt-1">Add someone to your circle first so you can send them a message.</p>
          <a href="/circle" className="mt-2 inline-block font-medium underline">Go to Circle</a>
        </div>
      )}

      {connections.length === 1 && connections[0]?.partnerName && (
        <p className="text-sm text-slate-500">
          Writing to <span className="font-medium text-slate-700">{connections[0].partnerName}</span>
        </p>
      )}

      <textarea
        value={rawMessage}
        onChange={(e) => setRawMessage(e.target.value)}
        placeholder="Write what you want to say..."
        rows={5}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      />

      <TopicWarnings hints={topicHints} text={rawMessage} />

      {!rephrased && !held && (
        <button
          onClick={handleTune}
          disabled={loading || !rawMessage.trim() || !selectedConnection}
          className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Tuning..." : "Tune Message"}
        </button>
      )}

      {held && (
        <div className={`rounded-xl p-4 border ${
          held.heldReason === "red_topic"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          {held.heldReason === "red_topic" && (
            <>
              <p className="font-medium">Message held</p>
              <p className="text-sm mt-1">
                This touches a topic your partner marked as sensitive
                {held.topics?.length > 0 && ` (${held.topics.join(", ")})`}.
                They are not ready to discuss this right now.
              </p>
              {held.aiReasons?.length > 0 && (
                <ul className="text-xs mt-2 space-y-1">
                  {held.aiReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {held.heldReason === "ai_failed" && (
            <>
              <p className="font-medium">Saved as draft</p>
              <p className="text-sm mt-1">
                AI rephrasing is temporarily unavailable. Your message has been saved — you can retry later.
              </p>
            </>
          )}
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => { handleReset(); setRawMessage(""); }}
              className="text-sm font-medium underline"
            >
              Write new message
            </button>
            {held.heldReason === "ai_failed" && (
              <button
                onClick={handleTune}
                className="text-sm font-medium underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {rephrased && (
        <div className="space-y-4">
          {topicVerdict?.status === "clear" && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-medium">AI Check Passed</span>
              <span className="text-emerald-600">— No boundary topics detected. Good to send.</span>
            </div>
          )}
          {topicVerdict?.status === "caution" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">AI noticed some gentle topics</span>
              </div>
              <ul className="text-xs text-amber-600 mt-2 space-y-1 ml-7">
                {topicVerdict.details?.map((d, i) => (
                  <li key={i}>{d.topic}: {d.reason}</li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 mt-2 ml-7">The AI has softened the tone for these. You can still send.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">Your words</p>
              <p className="text-gray-700">{rawMessage}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
              <p className="text-xs font-medium text-emerald-400 uppercase mb-2">Tuned version</p>
              <p className="text-emerald-900">{rephrased}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleSend("rephrased")}
              disabled={loading}
              className="flex-1 bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Tuned"}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
