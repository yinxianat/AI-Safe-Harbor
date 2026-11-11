"use client";

/**
 * Landing page for /chat. Redirects to the first active connection's
 * chat thread, or shows an empty state if the user has no connections.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ChatIndexPage() {
  const router = useRouter();
  const [noConnections, setNoConnections] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/connections");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const conns = data.connections || [];
          if (conns.length > 0) {
            router.replace(`/chat/${conns[0].id}`);
          } else {
            setNoConnections(true);
          }
        } else {
          setNoConnections(true);
        }
      } catch {
        if (!cancelled) setNoConnections(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (noConnections) {
    return (
      <div className="space-y-6 pt-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">No conversations yet</h1>
          <p className="text-sm text-slate-500">
            Add someone to your circle to start chatting.
          </p>
          <Link
            href="/circle"
            className="inline-block bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Go to Circle
          </Link>
        </div>
      </div>
    );
  }

  // While redirecting, show a spinner.
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}
