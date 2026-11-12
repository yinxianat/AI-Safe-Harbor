"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function initials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export default function ChatIndexPage() {
  const router = useRouter();
  const [connections, setConnections] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/connections");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setConnections(data.connections || []);
        } else {
          setConnections([]);
        }
      } catch {
        if (!cancelled) setConnections([]);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (connections === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="space-y-6 pt-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">No conversations yet</h1>
          <p className="text-sm text-slate-500">Add someone to your circle to start chatting.</p>
          <Link
            href="/circle"
            className="inline-block bg-emerald-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Go to Circle
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      <h1 className="text-lg font-bold text-slate-900 px-1">Conversations</h1>
      <div className="space-y-1">
        {connections.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white border border-gray-100 hover:bg-emerald-50 hover:border-emerald-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
              {initials(c.partnerName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{c.partnerName}</p>
              <p className="text-xs text-slate-400 truncate">
                {c.relationshipType === "spouse" ? "Partner" : c.relationshipType || "Connection"}
              </p>
            </div>
            <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
