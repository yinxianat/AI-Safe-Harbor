"use client";

import { useEffect, useState, useCallback } from "react";
import MessageCard from "@/components/MessageCard";

export default function InboxPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/inbox");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
        <button
          onClick={() => { setLoading(true); loadMessages(); }}
          className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && messages.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">No messages yet</p>
          <p className="text-sm">Messages from your partner will appear here</p>
        </div>
      )}

      {!loading && messages.map((msg) => (
        <MessageCard
          key={msg.id}
          senderName={msg.senderName}
          content={msg.content}
          sentAt={msg.sentAt}
        />
      ))}
    </div>
  );
}
