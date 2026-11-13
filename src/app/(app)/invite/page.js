"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context.js";

export default function InvitePage() {
  const { t } = useT();
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
          setError(t("invite_cannot_invite_self"));
        } else if (data.error === "connection_exists") {
          setError(t("invite_already_connected"));
        } else {
          setError(t("generic_error"));
        }
        return;
      }

      setSent(true);
    } catch {
      setError(t("network_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("invite_title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("invite_subtitle")}</p>
      </div>

      {sent ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-6 text-center">
          <p className="font-medium mb-1">{t("invite_sent_title")}</p>
          <p className="text-sm">{t("invite_sent_to")} <strong>{email}</strong></p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="mt-4 text-sm font-medium text-emerald-700 underline"
          >
            {t("invite_send_another")}
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
            placeholder={t("invite_email_placeholder")}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("invite_sending") : t("invite_send")}
          </button>
        </form>
      )}
    </div>
  );
}
