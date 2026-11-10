"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { validateEmailShape, suggestCorrection } from "@/lib/email-hints.js";

const RESEND_COOLDOWN_SECONDS = 30;

const ERROR_MESSAGES = {
  expired: "That link has expired. Request a new one below.",
  consumed: "That link has already been used. Request a new one below.",
  missing_token: "That link was incomplete. Request a new one below.",
  invalid_token: "That link is not valid. Request a new one below.",
  wrong_purpose: "That link cannot be used to sign in. Request a new one below.",
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
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
      {ERROR_MESSAGES[error] || "Something went wrong. Please try again."}
    </div>
  );
}

function useCountdown(until) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!until) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    const quick = setTimeout(tick, 10);
    const id = setInterval(tick, 500);
    return () => {
      clearTimeout(quick);
      clearInterval(id);
    };
  }, [until]);

  return until ? remaining : 0;
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [undeliverable, setUndeliverable] = useState(false);
  const inFlight = useRef(false);

  const cooldown = useCountdown(cooldownUntil);

  async function send(address) {
    // A double-click must not produce two links; the first invalidates nothing
    // but the second email confuses the recipient.
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setProblem(null);

    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const wait = data.retryAfter || 60;
        setProblem(`Too many requests. Please wait ${wait} seconds before trying again.`);
        setCooldownUntil(Date.now() + wait * 1000);
        return;
      }

      if (!res.ok) {
        setProblem("We could not send the link just now. Please try again in a moment.");
        return;
      }

      // The server reports mail-system health, not anything about this
      // address, so acting on it cannot reveal whether the account exists.
      const body = await res.json().catch(() => ({}));
      setUndeliverable(Boolean(body.deliveryDegraded));
      setSentTo(address);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch {
      // The request may still have been delivered, so do not claim it failed.
      setProblem(
        "We lost the connection before we could confirm. Check your inbox first — if nothing arrives, try again."
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    const check = validateEmailShape(email);
    if (!check.ok) {
      setProblem(check.message);
      return;
    }

    // A typo is the most likely reason a link "never arrives", and it is
    // invisible after sending — so ask before, not after.
    const maybe = suggestCorrection(check.email);
    if (maybe && maybe !== suggestion) {
      setSuggestion(maybe);
      return;
    }

    send(check.email);
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        {undeliverable ? (
          // Telling someone to check their inbox when the mail system is known
          // to be down is the single most confusing thing this page can do: it
          // reads as "your address is wrong" and sends them to look for a
          // message that does not exist.
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="font-medium text-red-800">We couldn&rsquo;t send your sign-in link</p>
            <p className="mt-2 text-sm text-red-700">
              Email delivery is temporarily unavailable. This is a problem on our side —
              nothing is wrong with <strong>{sentTo}</strong>.
            </p>
            <p className="mt-3 text-sm text-red-700">
              Your link was created and is waiting, so please try again shortly. The
              administrator has been notified automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <p className="font-medium text-emerald-800">Check your email</p>
            <p className="mt-1 text-sm text-emerald-700">
              We sent a sign-in link to <strong>{sentTo}</strong>
            </p>
            <p className="mt-3 text-sm text-emerald-700">
              It usually arrives within a minute. The link works for 15 minutes.
            </p>
            <p className="mt-2 text-xs text-emerald-600">
              Not there yet? Check your spam or promotions folder.
            </p>
          </div>
        )}

        {problem && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {problem}
          </div>
        )}

        <div className="text-center text-sm text-slate-500">
          {cooldown > 0 ? (
            <p>You can send another link in {cooldown}s</p>
          ) : (
            <p>
              {undeliverable ? "Ready to " : "Still nothing? Make sure the address above is right, or "}
              <button
                onClick={() => send(sentTo)}
                disabled={loading}
                className="font-medium text-indigo-600 underline hover:text-indigo-800 disabled:opacity-50"
              >
                {loading ? "sending…" : undeliverable ? "try again" : "send it again"}
              </button>
            </p>
          )}
          <button
            onClick={() => {
              setSentTo(null);
              setProblem(null);
              setSuggestion(null);
              setCooldownUntil(null);
              setUndeliverable(false);
            }}
            className="mt-3 text-slate-400 underline hover:text-slate-600"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {problem && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {problem}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setProblem(null);
            setSuggestion(null);
          }}
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {suggestion && (
          <p className="mt-2 text-sm text-amber-700">
            Did you mean{" "}
            <button
              type="button"
              onClick={() => {
                setEmail(suggestion);
                setSuggestion(null);
                send(suggestion);
              }}
              className="font-medium underline"
            >
              {suggestion}
            </button>
            ?{" "}
            <button
              type="button"
              onClick={() => send(validateEmailShape(email).email)}
              className="text-slate-500 underline"
            >
              No, use what I typed
            </button>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Leeway</h1>
          <p className="text-slate-500">Give each other room.</p>
          <p className="mt-4 text-sm text-slate-500">
            We&rsquo;ll email you a sign-in link. No password needed.
          </p>
        </div>

        <Suspense fallback={null}>
          <ErrorBanner />
        </Suspense>

        <SignInForm />

        <p className="mt-8 text-center text-sm text-slate-400">
          <Link href="/about" className="underline hover:text-slate-600">
            What is Leeway?
          </Link>
        </p>
      </div>
    </div>
  );
}
