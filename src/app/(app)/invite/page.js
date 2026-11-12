"use client";

import { useState } from "react";

export default function InvitePage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "cannot_invite_self") {
          setError("You cannot invite yourself.");
        } else if (data.error === "connection_exists") {
          setError("You are already connected with this person.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invite Partner</h1>
        <p className="text-sm text-slate-500 mt-1">
          Send an invitation to connect on Leeway
        </p>
      </div>

      {sent ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-6 text-center">
          <p className="font-medium mb-1">Invitation sent!</p>
          <p className="text-sm">We sent an invite link to <strong>{email}</strong></p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="mt-4 text-sm font-medium text-emerald-700 underline"
          >
            Send another invite
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@example.com"
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Invitation"}
          </button>
        </form>
      )}
    </div>
  );
}
