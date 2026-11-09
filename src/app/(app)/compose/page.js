"use client";

import { useState, useEffect } from "react";

export default function ComposePage() {
  const [rawMessage, setRawMessage] = useState("");
  const [rephrased, setRephrased] = useState(null);
  const [messageId, setMessageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [held, setHeld] = useState(null);
  const [sent, setSent] = useState(false);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState("");

  useEffect(() => {
    async function loadConnections() {
      const connRes = await fetch("/api/connections");
      if (connRes.ok) {
        const data = await connRes.json();
        setConnections(data.connections || []);
        if (data.connections?.length > 0) {
          setSelectedConnection(data.connections[0].id);
        }
      }
    }
    loadConnections();
  }, []);

  async function handleTune() {
    if (!rawMessage.trim() || !selectedConnection) return;
    setLoading(true);
    setHeld(null);
    setRephrased(null);
    setSent(false);

    try {
      const res = await fetch("/api/messages/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection,
          contentRaw: rawMessage,
        }),
      });

      const data = await res.json();

      if (data.held) {
        setHeld(data);
      } else {
        setRephrased(data.rephrased);
        setMessageId(data.messageId);
      }
    } catch {
      setHeld({ heldReason: "ai_failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(version) {
    if (!messageId) return;
    setLoading(true);

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
      }
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
          className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Compose</h1>

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
          <p>You need to connect with a partner first.</p>
          <a href="/invite" className="font-medium underline">Invite your partner</a>
        </div>
      )}

      <textarea
        value={rawMessage}
        onChange={(e) => setRawMessage(e.target.value)}
        placeholder="Write what you want to say..."
        rows={5}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />

      {!rephrased && !held && (
        <button
          onClick={handleTune}
          disabled={loading || !rawMessage.trim() || !selectedConnection}
          className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </>
          )}
          {held.heldReason === "ai_failed" && (
            <>
              <p className="font-medium">Saved as draft</p>
              <p className="text-sm mt-1">
                AI rephrasing is temporarily unavailable. Your message has been saved — you can retry later.
              </p>
              <button
                onClick={handleTune}
                className="mt-3 text-sm font-medium underline"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {rephrased && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">Your words</p>
              <p className="text-gray-700">{rawMessage}</p>
            </div>
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
              <p className="text-xs font-medium text-indigo-400 uppercase mb-2">Tuned version</p>
              <p className="text-indigo-900">{rephrased}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleSend("rephrased")}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
