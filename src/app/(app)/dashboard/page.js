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
      <div className={`w-12 h-12 ${tint} rounded-xl flex items-center justify-center shrink-0`}>{children}</div>
      <div className="min-w-0">
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

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [circle, setCircle] = useState({ members: [], incoming: [], outgoing: [] });
  const [boundariesSet, setBoundariesSet] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [insight, setInsight] = useState(null);
  const [stats, setStats] = useState(null);
  const [topicSummary, setTopicSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [explore, setExplore] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, circleRes, topicsRes, sentRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/circle"),
          fetch("/api/settings/topics"),
          fetch("/api/messages/inbox?box=sent"),
        ]);

        if (cancelled) return;

        if (!meRes.ok) {
          setError("Could not load your profile. The server may be temporarily unavailable.");
          setLoading(false);
          return;
        }

        setUser(await meRes.json());

        if (circleRes.ok) setCircle(await circleRes.json());

        if (topicsRes.ok) {
          const data = await topicsRes.json();
          const settings = data.settings || [];
          setBoundariesSet(settings.some((s) => s.isCustom || s.comfortLevel !== "green"));
          const counts = { green: 0, yellow: 0, red: 0 };
          settings.forEach((s) => { if (counts[s.comfortLevel] !== undefined) counts[s.comfortLevel]++; });
          setTopicSummary(counts);
        }

        if (sentRes.ok) {
          setHasSent(((await sentRes.json()).messages || []).length > 0);
        }

        if (!cancelled) {
          setError(null);
          setLoading(false);
        }

        try {
          const [companionRes, unreadRes] = await Promise.all([
            fetch("/api/companions"),
            fetch("/api/messages/unread"),
          ]);
          if (!cancelled && companionRes.ok) {
            const cd = await companionRes.json();
            setInsight(cd.insight);
            setStats(cd.stats);
          }
          if (!cancelled && unreadRes.ok) {
            const ud = await unreadRes.json();
            setUnread(ud.unread || 0);
          }
        } catch {
          // optional data
        }
      } catch {
        if (!cancelled) {
          setError("Could not connect to the server. Check your internet connection and try again.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [retryKey]);

  const connected = circle.members.length > 0;
  const partnerName = circle.members[0]?.displayName || (circle.members[0]?.username ? `@${circle.members[0].username}` : "your person");
  const connectionId = circle.members[0]?.connectionId;
  const pendingCount = circle.incoming.length;
  const setupDone = Boolean(user?.username) && boundariesSet && connected && hasSent;
  const hasBoundaryData = topicSummary && (topicSummary.yellow > 0 || topicSummary.red > 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); setRetryKey((k) => k + 1); }} />}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
        <p className="text-slate-500 mt-1">
          {connected
            ? `Connected with ${partnerName}.`
            : "Leeway tunes your words so they land the way you mean them."}
        </p>
      </div>

      {!setupDone && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Get set up
          </h2>
          <Step done={Boolean(user?.username)} href="/circle" title="Claim your @username" detail="So your person can find you" />
          <Step done={boundariesSet} href="/settings" title="Set your tone & boundaries" detail="How messages should arrive for you" />
          <Step done={connected} href="/circle" title="Add your person to your Circle" detail="Search their @username and send a request" />
          <Step done={hasSent} href="/compose" title="Send your first message" detail="Write it your way — Leeway tunes it" />
        </div>
      )}

      {insight && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">
            AI Companion
          </p>
          <p className="text-sm text-violet-800">{insight}</p>
          {stats && (
            <p className="text-xs text-violet-500 mt-2">
              This week: {stats.sentThisWeek} sent, {stats.receivedThisWeek} received
            </p>
          )}
        </div>
      )}

      {connected && hasBoundaryData && (
        <Link
          href={connectionId ? `/partner?connectionId=${connectionId}` : "/settings"}
          className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {partnerName}&apos;s bandwidth
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-sm">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-1.5 align-middle" />
              {topicSummary.green} open
            </span>
            <span className="text-sm">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-400 mr-1.5 align-middle" />
              {topicSummary.yellow} gentle
            </span>
            <span className="text-sm">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1.5 align-middle" />
              {topicSummary.red} not ready
            </span>
          </div>
          <p className="text-xs text-indigo-600 mt-2 font-medium">Tap to see details →</p>
        </Link>
      )}

      {pendingCount > 0 && (
        <Link
          href="/circle"
          className="flex items-center gap-3 bg-pink-50 border border-pink-100 rounded-xl p-4"
        >
          <span className="bg-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">
            {pendingCount}
          </span>
          <span className="text-sm text-pink-800 font-medium">
            {pendingCount === 1 ? "Someone wants to connect" : `${pendingCount} people want to connect`}
          </span>
        </Link>
      )}

      <div className="grid gap-3">
        <ActionCard href="/compose" title="Send a message" detail="Write freely — AI tunes it to their style" tint="bg-indigo-100">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </ActionCard>

        <ActionCard href="/inbox" title="Messages" detail={connected ? `Read messages from ${partnerName}` : "Received and sent messages"} tint="bg-emerald-100" badge={unread}>
          <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </ActionCard>
      </div>

      {setupDone && (
        <div className="space-y-3">
          <button
            onClick={() => setExplore((v) => !v)}
            className="flex items-center justify-between w-full text-sm font-semibold text-slate-700 uppercase tracking-wide"
          >
            <span>More ways to connect</span>
            <span className="text-slate-400">{explore ? "−" : "+"}</span>
          </button>
          {explore && (
            <div className="grid gap-3">
              <ActionCard href="/knowme" title="Know Me" detail="Favorites, pet peeves, stories — help your person understand you" tint="bg-violet-100">
                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </ActionCard>

              <ActionCard href="/practice" title="Practice Pad" detail="Rehearse a tough conversation with AI before sending for real" tint="bg-teal-100">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </ActionCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
