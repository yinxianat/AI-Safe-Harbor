"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Admin PIN sign-in page.
 *
 * This is the only route reachable without a session that can produce one
 * without going through email. It exists for the case where email itself is
 * what broke, so the operator can get into the dashboard that would diagnose
 * it. Only works when ADMIN_PIN is set on the deployment.
 */
export default function AdminPinPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [state, setState] = useState({ kind: "idle" });

  async function onSubmit(e) {
    e.preventDefault();
    setState({ kind: "working" });

    let res;
    try {
      res = await fetch("/api/auth/admin-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
      return;
    }

    // 404 is the unset-PIN signal — the endpoint is deliberately invisible
    // on a deployment that has not set ADMIN_PIN. Show the operator what to
    // change rather than letting the page look generically broken.
    if (res.status === 404) {
      setState({
        kind: "error",
        message:
          "The PIN bootstrap is off on this deployment. Set ADMIN_PIN in the environment and redeploy.",
      });
      return;
    }
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      setState({
        kind: "error",
        message: `Too many attempts. Try again in ${body.retryAfterSeconds ?? 900} seconds.`,
      });
      return;
    }
    if (!res.ok) {
      // Deliberately generic — the server does not say which half was wrong.
      setState({ kind: "error", message: "That email and PIN did not match." });
      return;
    }

    router.push("/admin");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <h1 className="text-2xl font-bold text-slate-900">Admin bootstrap</h1>
      <p className="mt-2 text-sm text-slate-600">
        Use the PIN set on this deployment. Only enabled when email delivery is
        broken — sign in via the normal magic link once mail is working again.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Admin email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">PIN</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-mono focus:border-emerald-400 focus:outline-none"
          />
        </label>

        {state.kind === "error" && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={state.kind === "working"}
          className="mt-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {state.kind === "working" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <Link href="/" className="mt-6 text-center text-sm text-emerald-600 hover:underline">
        Back to the normal sign-in
      </Link>
    </div>
  );
}
