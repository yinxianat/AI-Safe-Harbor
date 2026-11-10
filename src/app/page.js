"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

const ERROR_MESSAGES = {
  expired: "This link has expired. Please request a new one.",
  consumed: "This link has already been used.",
  missing_token: "Invalid link. Please request a new one.",
  inviter_not_found: "That invitation is no longer valid. Ask for a new one.",
  cannot_invite_self: "You cannot connect with yourself.",
};

// Isolated because useSearchParams opts a component out of prerendering.
// Keeping it to this one banner means the rest of the page is still server
// rendered — otherwise the whole landing page is a spinner until hydration.
function ErrorBanner() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm text-center">
      {ERROR_MESSAGES[error] || "Something went wrong. Please try again."}
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-6 text-center">
        <p className="font-medium mb-1">Check your email</p>
        <p className="text-sm">
          We sent a sign-in link to <strong>{email}</strong>
        </p>
        <p className="text-xs text-emerald-500 mt-3">The link expires in 15 minutes</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        aria-label="Email address"
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sending..." : "Send me a link"}
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Leeway</h1>
          <p className="text-slate-500">Give each other room.</p>
        </div>

        <Suspense fallback={null}>
          <ErrorBanner />
        </Suspense>

        <LoginForm />

        <p className="mt-8 text-center text-sm text-slate-400">
          <Link href="/about" className="underline hover:text-slate-600">
            What is Leeway?
          </Link>
        </p>
      </div>
    </div>
  );
}
