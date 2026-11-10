"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function Step({ done, href, title, detail }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        done ? "border-emerald-100 bg-emerald-50/60" : "border-gray-100 bg-white hover:border-indigo-200"
      }`}
    >
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${done ? "text-emerald-800" : "text-slate-800"}`}>
          {title}
        </span>
        {!done && <span className="block text-xs text-slate-500">{detail}</span>}
      </span>
    </Link>
  );
}

function ActionCard({ href, title, detail, tint, children, badge }) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow active:scale-[0.98]"
    >
      <div className={`w-12 h-12 ${tint} rounded-xl flex items-center justify-center`}>{children}</div>
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="text-sm text-slate-500">{detail}</p>
      </div>
      {badge > 0 && (
        <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [circle, setCircle] = useState({ members: [], incoming: [], outgoing: [] });
  const [boundariesSet, setBoundariesSet] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  useEffect(() => {
    async function load() {
      const [meRes, circleRes, topicsRes, sentRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/circle"),
        fetch("/api/settings/topics"),
        fetch("/api/messages/inbox?box=sent"),
      ]);
      if (meRes.ok) setUser(await meRes.json());
      if (circleRes.ok) setCircle(await circleRes.json());
      if (topicsRes.ok) {
        const data = await topicsRes.json();
        setBoundariesSet(
          (data.settings || []).some((s) => s.isCustom || s.comfortLevel !== "green")
        );
      }
      if (sentRes.ok) {
        setHasSent(((await sentRes.json()).messages || []).length > 0);
      }
    }
    load();
  }, []);

  const connected = circle.members.length > 0;
  const partnerName = circle.members[0]?.displayName || circle.members[0]?.username;
  const pendingCount = circle.incoming.length;
  const setupDone = Boolean(user?.username) && boundariesSet && connected && hasSent;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
        <p className="text-slate-500 mt-1">
          {connected
            ? `Connected with ${partnerName}. How would you like to connect today?`
            : "Leeway tunes your words so they land the way you mean them."}
        </p>
      </div>

      {!setupDone && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Get set up
          </h2>
          <Step
            done={Boolean(user?.username)}
            href="/circle"
            title="Claim your @username"
            detail="So your person can find you"
          />
          <Step
            done={boundariesSet}
            href="/settings"
            title="Set your tone & boundaries"
            detail="How messages should arrive for you — works before anyone connects"
          />
          <Step
            done={connected}
            href="/circle"
            title="Add your person to your Circle"
            detail="Search their @username and send a request"
          />
          <Step
            done={hasSent}
            href="/compose"
            title="Send your first message"
            detail="Write it your way — Leeway tunes it to their preferences"
          />
        </div>
      )}

      <div className="grid gap-3">
        <ActionCard href="/compose" title="Send a message" detail="Compose with AI-assisted tone tuning" tint="bg-indigo-100">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </ActionCard>

        <ActionCard
          href="/inbox"
          title="Messages"
          detail={connected ? `Read messages from ${partnerName}` : "Received and sent messages"}
          tint="bg-emerald-100"
        >
          <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </ActionCard>

        <ActionCard
          href="/circle"
          title="Your Circle"
          detail={
            pendingCount > 0
              ? `${pendingCount} request${pendingCount > 1 ? "s" : ""} waiting for you`
              : connected
                ? "Manage who you share with"
                : "Find your person by @username"
          }
          tint="bg-pink-100"
          badge={pendingCount}
        >
          <svg className="w-6 h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
          </svg>
        </ActionCard>

        <ActionCard href="/settings" title="Settings" detail="Your tone and topic boundaries" tint="bg-amber-100">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </ActionCard>
      </div>
    </div>
  );
}
