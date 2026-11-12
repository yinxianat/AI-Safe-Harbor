"use client";

import { useEffect, useState, useCallback, useReducer, useMemo } from "react";
import MessageCard from "@/components/MessageCard";
import { REACTIONS, getReaction } from "@/lib/reactions.js";

function ReactionBar({ message, onReact }) {
  return (
    <div className="flex gap-1.5 mt-2 flex-wrap">
      {REACTIONS.map((r) => {
        const active = message.reaction === r.key;
        return (
          <button
            key={r.key}
            onClick={() => onReact(message.id, active ? null : r.key)}
            title={r.label}
            aria-pressed={active}
            className={`text-sm px-2.5 py-1.5 rounded-full border transition-colors ${
              active
                ? "bg-emerald-100 border-emerald-300"
                : "bg-white border-gray-200 hover:border-gray-300"
            }`}
          >
            {r.emoji}
            {active && <span className="ml-1 text-xs text-emerald-700">{r.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TopicWarnings({ hints, text }) {
  const detected = useMemo(() => {
    if (!text.trim() || hints.length === 0) return [];
    const lower = text.toLowerCase();
    return hints.filter((h) => h.keywords.some((kw) => lower.includes(kw)));
  }, [hints, text]);

  if (detected.length === 0 && text.trim().length > 0 && hints.length > 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        No boundary topics detected
      </div>
    );
  }
  if (detected.length === 0) return null;

  const red = detected.filter((d) => d.level === "red");
  const yellow = detected.filter((d) => d.level === "yellow");

  return (
    <div className="space-y-1.5">
      {red.map((t) => (
        <div key={t.topicName} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500 mt-0.5 shrink-0" />
          <span><strong>{t.label}</strong> — not ready. Will be held.</span>
        </div>
      ))}
      {yellow.map((t) => (
        <div key={t.topicName} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 mt-0.5 shrink-0" />
          <span><strong>{t.label}</strong> — gentle. AI will soften.</span>
        </div>
      ))}
    </div>
  );
}

function InlineReply({ connectionId, onSent, onCancel }) {
  const [text, setText] = useState("");
  const [tuning, setTuning] = useState(false);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [hints, setHints] = useState([]);

  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/compose/topic-hints?connectionId=${connectionId}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setHints(data.hints || []);
        }
      } catch { /* optional */ }
    })();
    return () => { cancelled = true; };
  }, [connectionId]);

  async function handleTune() {
    if (!text.trim()) return;
    setTuning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/messages/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, contentRaw: text }),
      });
      if (!res.ok && res.status >= 500) {
        setError("Server error. Try again.");
        setTuning(false);
        return;
      }
      const data = await res.json();
      if (data.held) {
        setResult({ type: "held", reason: data.heldReason, topics: data.topics, aiReasons: data.aiReasons });
      } else {
        setResult({
          type: "ready",
          messageId: data.messageId,
          raw: text,
          rephrased: data.rephrased,
          topicVerdict: data.topicVerdict,
        });
      }
    } catch {
      setError("Network error. Check your connection.");
    }
    setTuning(false);
  }

  async function handleSend() {
    if (!result?.messageId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: result.messageId, versionSent: "rephrased" }),
      });
      if (res.ok) {
        onSent();
      } else {
        setError("Could not send. Try again.");
      }
    } catch {
      setError("Network error.");
    }
    setSending(false);
  }

  if (result?.type === "ready") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-2 space-y-3">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Reply preview</p>
        {result.topicVerdict?.status === "clear" && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium">AI Check Passed</span> — Good to send
          </div>
        )}
        {result.topicVerdict?.status === "caution" && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="font-medium">Gentle topics noted</span> — AI softened the tone
            </div>
          </div>
        )}
        <div className="bg-white rounded-lg p-3 text-sm text-slate-600">
          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Your words</p>
          <p>{result.raw}</p>
        </div>
        <div className="bg-emerald-100 rounded-lg p-3 text-sm text-emerald-900">
          <p className="text-xs font-medium text-emerald-400 uppercase mb-1">Tuned version</p>
          <p>{result.rephrased}</p>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send Reply"}
          </button>
          <button
            onClick={() => setResult(null)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
          >
            Edit
          </button>
          <button onClick={onCancel} className="px-3 py-2.5 text-sm text-slate-400">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (result?.type === "held") {
    return (
      <div className={`rounded-xl p-4 mt-2 border ${
        result.reason === "red_topic"
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}>
        <p className="font-medium text-sm">
          {result.reason === "red_topic" ? "Reply held" : "Saved as draft"}
        </p>
        <p className="text-xs mt-1">
          {result.reason === "red_topic"
            ? `Touches a topic they marked as sensitive${result.topics?.length ? ` (${result.topics.join(", ")})` : ""}.`
            : "AI unavailable — saved as draft. Retry later from the Drafts tab."}
        </p>
        {result.aiReasons?.length > 0 && (
          <ul className="text-xs mt-2 space-y-1 opacity-80">
            {result.aiReasons.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={() => { setResult(null); setText(""); }} className="text-xs font-medium underline">
            Write something else
          </button>
          <button onClick={onCancel} className="text-xs text-slate-500">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-2 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your reply…"
        rows={3}
        maxLength={5000}
        autoFocus
        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <TopicWarnings hints={hints} text={text} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleTune}
          disabled={tuning || !text.trim()}
          className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {tuning ? "Tuning…" : "Tune Reply"}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-400">Cancel</button>
      </div>
    </div>
  );
}

const HELD_REASON_LABELS = {
  red_topic: "Touches a sensitive topic",
  ai_failed: "AI unavailable — saved as draft",
  content_refused: "Content was flagged",
};

function HeldCard({ message, onRetry, retrying }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">{message.partnerName}</p>
          <p className="text-sm text-slate-600 mt-1">{message.contentPreview}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              message.heldReason === "red_topic"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {HELD_REASON_LABELS[message.heldReason] || message.heldReason}
            </span>
            {message.topicTags?.length > 0 && (
              <span className="text-xs text-slate-400 truncate">{message.topicTags.join(", ")}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {new Date(message.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        {message.canRetry && (
          <button
            onClick={() => onRetry(message.id)}
            disabled={retrying}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-800 disabled:opacity-50 shrink-0"
          >
            {retrying ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>
    </div>
  );
}

function inboxReducer(state, action) {
  switch (action.type) {
    case "start": return { ...state, loading: true, messages: [], error: null };
    case "done": return { ...state, loading: false, messages: action.messages };
    case "error": return { ...state, loading: false, error: action.error };
    case "clear_error": return { ...state, error: null };
    case "react":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, reaction: action.reaction } : m
        ),
      };
    case "remove":
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.id),
      };
    default: return state;
  }
}

export default function InboxPage() {
  const [{ messages, loading, error }, dispatch] = useReducer(inboxReducer, {
    messages: [],
    loading: true,
    error: null,
  });
  const [box, setBox] = useState("received");
  const [retryingId, setRetryingId] = useState(null);
  const [retryResult, setRetryResult] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const loadMessages = useCallback(async (which) => {
    try {
      const url = which === "held" ? "/api/messages/held" : `/api/messages/inbox?box=${which}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return { messages: data.messages || [] };
      }
      return { error: "Could not load messages. Please try again." };
    } catch {
      return { error: "Network error. Check your connection and try again." };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "start" });
    loadMessages(box).then((result) => {
      if (cancelled) return;
      setRetryResult(null);
      setReplyingTo(null);
      if (result.error) {
        dispatch({ type: "error", error: result.error });
      } else {
        dispatch({ type: "done", messages: result.messages });
      }
    });
    return () => { cancelled = true; };
  }, [box, loadMessages]);

  useEffect(() => {
    if (box !== "received") return;
    fetch("/api/messages/read", { method: "POST" }).catch(() => {});
  }, [box, messages]);

  async function handleReact(messageId, reaction) {
    dispatch({ type: "react", id: messageId, reaction });
    try {
      const res = await fetch("/api/messages/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reaction }),
      });
      if (!res.ok) {
        dispatch({ type: "error", error: "Could not save your reaction. Please try again." });
      }
    } catch {
      dispatch({ type: "error", error: "Network error saving your reaction." });
    }
  }

  async function handleRetry(messageId) {
    setRetryingId(messageId);
    setRetryResult(null);
    try {
      const res = await fetch("/api/messages/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json();
      if (data.held) {
        setRetryResult({ type: "still_held", reason: data.heldReason });
      } else {
        dispatch({ type: "remove", id: messageId });
        setRetryResult({ type: "ready", messageId: data.messageId, raw: data.raw, rephrased: data.rephrased });
      }
    } catch {
      dispatch({ type: "error", error: "Network error retrying message." });
    } finally {
      setRetryingId(null);
    }
  }

  async function handleSendRetried() {
    if (!retryResult?.messageId) return;
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: retryResult.messageId, versionSent: "rephrased" }),
      });
      if (res.ok) {
        setRetryResult({ type: "sent" });
      } else {
        dispatch({ type: "error", error: "Could not send the message." });
      }
    } catch {
      dispatch({ type: "error", error: "Network error sending message." });
    }
  }

  function handleRefresh() {
    dispatch({ type: "start" });
    setRetryResult(null);
    setReplyingTo(null);
    loadMessages(box).then((result) => {
      if (result.error) {
        dispatch({ type: "error", error: result.error });
      } else {
        dispatch({ type: "done", messages: result.messages });
      }
    });
  }

  function handleReplySent() {
    setReplyingTo(null);
    handleRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <button
          onClick={handleRefresh}
          className="text-sm text-emerald-600 font-medium hover:text-emerald-800"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error}</p>
          <button onClick={() => dispatch({ type: "clear_error" })} className="text-xs font-medium underline mt-1">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex rounded-xl bg-slate-100 p-1">
        {["received", "sent", "held"].map((b) => {
          const label = b === "held" ? "Drafts" : b.charAt(0).toUpperCase() + b.slice(1);
          return (
            <button
              key={b}
              onClick={() => setBox(b)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
                box === b ? "bg-white shadow text-slate-900" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {retryResult?.type === "ready" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-emerald-800">Message ready to send</p>
          <div className="bg-white rounded-lg p-3 text-sm text-slate-600">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Your words</p>
            <p>{retryResult.raw}</p>
          </div>
          <div className="bg-emerald-100 rounded-lg p-3 text-sm text-emerald-900">
            <p className="text-xs font-medium text-emerald-400 uppercase mb-1">Tuned version</p>
            <p>{retryResult.rephrased}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSendRetried}
              className="flex-1 bg-emerald-600 text-white font-medium py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Send Tuned
            </button>
            <button
              onClick={() => setRetryResult(null)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {retryResult?.type === "sent" && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-center">
          <p className="font-medium">Message sent!</p>
          <button onClick={() => setRetryResult(null)} className="text-xs underline mt-1">Dismiss</button>
        </div>
      )}

      {retryResult?.type === "still_held" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm">
          <p className="font-medium">Still held</p>
          <p className="mt-1">{HELD_REASON_LABELS[retryResult.reason] || "Could not deliver this message."}</p>
          <button onClick={() => setRetryResult(null)} className="text-xs underline mt-1">Dismiss</button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && messages.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">
            {box === "held" ? "Nothing here" : box === "sent" ? "Nothing sent yet" : "No messages yet"}
          </p>
          <p className="text-sm">
            {box === "held"
              ? "Unsent drafts and blocked messages will appear here"
              : box === "sent"
                ? "Messages you send appear here, with your person's reaction"
                : "Messages from your circle will appear here"}
          </p>
        </div>
      )}

      {!loading && box === "held" && messages.length > 0 && (() => {
        const blocked = messages.filter((m) => m.heldReason === "red_topic");
        const drafts = messages.filter((m) => m.heldReason !== "red_topic");
        return (
          <div className="space-y-4">
            {blocked.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-red-600">Blocked by boundaries</h2>
                <p className="text-xs text-slate-500">Your person isn&apos;t ready for these topics right now.</p>
                {blocked.map((msg) => (
                  <HeldCard key={msg.id} message={msg} onRetry={handleRetry} retrying={retryingId === msg.id} />
                ))}
              </div>
            )}
            {drafts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-amber-600">Unsent drafts</h2>
                <p className="text-xs text-slate-500">These can be retried when AI is available again.</p>
                {drafts.map((msg) => (
                  <HeldCard key={msg.id} message={msg} onRetry={handleRetry} retrying={retryingId === msg.id} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {!loading && box !== "held" &&
        messages.map((msg) => (
          <div key={msg.id}>
            <MessageCard
              senderName={box === "sent" ? `To ${msg.partnerName}` : msg.senderName}
              content={msg.content}
              sentAt={msg.sentAt}
            />
            {box === "received" && (
              <>
                <div className="flex items-center gap-3 mt-1">
                  <ReactionBar message={msg} onReact={handleReact} />
                  {replyingTo !== msg.id && (
                    <button
                      onClick={() => setReplyingTo(msg.id)}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-800 shrink-0 ml-auto"
                    >
                      Reply
                    </button>
                  )}
                </div>
                {replyingTo === msg.id && (
                  <InlineReply
                    connectionId={msg.connectionId}
                    onSent={handleReplySent}
                    onCancel={() => setReplyingTo(null)}
                  />
                )}
              </>
            )}
            {box === "sent" && msg.reaction && (
              <p className="mt-2 text-sm text-slate-500">
                {getReaction(msg.reaction)?.emoji}{" "}
                {msg.partnerName} felt: {getReaction(msg.reaction)?.label}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
