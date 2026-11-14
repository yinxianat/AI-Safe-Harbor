"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context.js";
export default function DeleteAccountCard() {
  const router = useRouter();
  const { t } = useT();
  // Two gates before anything is destroyed: an explicit "are you sure", then
  // typing DELETE. Account deletion cascades across messages, notes and every
  // connection, so a single mis-tap must not be able to reach it.
  const [step, setStep] = useState("idle");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  function reset() {
    setStep("idle");
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (res.ok) {
        router.push("/");
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.detail || body.error || t("me_delete_fail"));
    } catch {
      setError(t("network_error"));
    }
    setDeleting(false);
  }

  if (step === "idle") {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3">
        <button
          onClick={() => setStep("asking")}
          className="text-xs text-red-500 font-medium"
        >
          {t("me_delete_my_account")}
        </button>
      </div>
    );
  }

  if (step === "asking") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
        <p className="text-sm font-semibold text-red-700">{t("me_delete_ask_title")}</p>
        <p className="text-[11px] text-red-700">{t("me_delete_ask_body")}</p>
        <div className="flex gap-2">
          {/* Keep is listed first and styled as the safe default. */}
          <button
            onClick={reset}
            className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-700 py-2 rounded-lg"
          >
            {t("me_delete_ask_keep")}
          </button>
          <button
            onClick={() => setStep("confirming")}
            className="flex-1 text-xs font-medium bg-red-600 text-white py-2 rounded-lg"
          >
            {t("me_delete_ask_continue")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-red-700 uppercase">{t("me_delete_account_title")}</p>
      <p className="text-[11px] text-red-700">{t("me_delete_account_body")}</p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={t("me_delete_confirm_placeholder")}
        spellCheck={false}
        autoCapitalize="characters"
        className="w-full px-2 py-2 rounded border border-red-300 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-600 py-2 rounded-lg"
        >
          {t("cancel")}
        </button>
        <button
          onClick={handleDelete}
          disabled={confirmText !== "DELETE" || deleting}
          className="flex-1 text-xs font-medium bg-red-600 text-white py-2 rounded-lg disabled:opacity-50"
        >
          {deleting ? t("me_deleting") : t("me_delete_forever")}
        </button>
      </div>
    </div>
  );
}
