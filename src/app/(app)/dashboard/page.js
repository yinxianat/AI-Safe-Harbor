"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    async function load() {
      const [meRes, connRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/connections"),
      ]);

      if (meRes.ok) {
        setUser(await meRes.json());
      }
      if (connRes.ok) {
        const data = await connRes.json();
        setConnection(data.connections?.[0] ?? null);
      }
    }
    load();
  }, []);

  const partnerName = connection?.partnerName || "your partner";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
        <p className="text-slate-500 mt-1">How would you like to connect today?</p>
      </div>

      <div className="grid gap-3">
        <Link
          href="/compose"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow active:scale-[0.98]"
        >
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Send a message</p>
            <p className="text-sm text-slate-500">Compose with AI-assisted tone tuning</p>
          </div>
        </Link>

        <Link
          href="/inbox"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow active:scale-[0.98]"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Inbox</p>
            <p className="text-sm text-slate-500">Read messages from {partnerName}</p>
          </div>
        </Link>

        <Link
          href="/settings"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow active:scale-[0.98]"
        >
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Topic Settings</p>
            <p className="text-sm text-slate-500">Set your comfort level for topics</p>
          </div>
        </Link>

        <Link
          href="/invite"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow active:scale-[0.98]"
        >
          <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Invite Partner</p>
            <p className="text-sm text-slate-500">Connect with your closest person</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
