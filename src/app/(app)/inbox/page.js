"use client";

import { useEffect, useState, useCallback, useReducer } from "react";
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
                ? "bg-indigo-100 border-indigo-300"
                : "bg-white border-gray-200 hover:border-gray-300"
            }`}
          >
            {r.emoji}
            {active && <span className="ml-1 text-xs text-indigo-700">{r.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function inboxReducer(state, action) {
  switch (action.type) {
    case "start": return { ...state, loading: true, messages: [] };
    case "done": return { ...state, loading: false, messages: action.messages };
    case "react":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, reaction: action.reaction } : m
        ),
      };
    default: return state;
  }
}

export default function InboxPage() {
  const [{ messages, loading }, dispatch] = useReducer(inboxReducer, {
    messages: [],
    loading: true,
  });
  const [box, setBox] = useState("received");

  const loadMessages = useCallback(async (which) => {
    const res = await fetch(`/api/messages/inbox?box=${which}`);
    if (res.ok) {
      const data = await res.json();
      return data.messages || [];
    }
    return [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "start" });
    loadMessages(box).then((msgs) => {
      if (!cancelled) dispatch({ type: "done", messages: msgs });
    });
    return () => { cancelled = true; };
  }, [box, loadMessages]);

  async function handleReact(messageId, reaction) {
    dispatch({ type: "react", id: messageId, reaction });
    await fetch("/api/messages/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, reaction }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <button
          onClick={() => { dispatch({ type: "start" }); loadMessages(box).then((msgs) => dispatch({ type: "done", messages: msgs })); }}
          className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
        >
          Refresh
        </button>
      </div>

      <div className="flex rounded-xl bg-slate-100 p-1">
        {["received", "sent"].map((b) => (
          <button
            key={b}
            onClick={() => setBox(b)}
            className={`flex-1 text-sm font-medium py-2 rounded-lg capitalize transition-colors ${
              box === b ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && messages.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">{box === "sent" ? "Nothing sent yet" : "No messages yet"}</p>
          <p className="text-sm">
            {box === "sent"
              ? "Messages you send appear here, with your person's reaction"
              : "Messages from your circle will appear here"}
          </p>
        </div>
      )}

      {!loading &&
        messages.map((msg) => (
          <div key={msg.id}>
            <MessageCard
              senderName={box === "sent" ? `To ${msg.partnerName}` : msg.senderName}
              content={msg.content}
              sentAt={msg.sentAt}
            />
            {box === "received" ? (
              <ReactionBar message={msg} onReact={handleReact} />
            ) : (
              msg.reaction && (
                <p className="mt-2 text-sm text-slate-500">
                  {getReaction(msg.reaction)?.emoji}{" "}
                  {msg.partnerName} felt: {getReaction(msg.reaction)?.label}
                </p>
              )
            )}
          </div>
        ))}
    </div>
  );
}
