"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context.js";
export default function PasswordCard() {
  const { t } = useT();
  const [hasPassword, setHasPassword] = useState(null);
  const [opened, setOpened] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [clearingReset, setClearingReset] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/password");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setHasPassword(Boolean(data.hasPassword));
        }
      } catch { /* leave as unknown */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      if (res.ok) {
        setMessage(t("password_saved"));
        setHasPassword(true);
        setCurrentPassword("");
        setNewPassword("");
        setOpened(false);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "invalid_current_password") {
          setError(t("wrong_current_password"));
        } else {
          setError(data.detail || t("password_update_failed"));
        }
      }
    } catch {
      setError(t("network_error"));
    }
    setSaving(false);
  }

  async function handleConfirmReset() {
    if (resetConfirm !== "RESET") return;
    setClearingReset(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", { method: "DELETE" });
      if (res.ok) {
        setHasPassword(false);
        setResetting(false);
        setResetConfirm("");
        setCurrentPassword("");
        setMessage(t("reset_password_cleared"));
      } else {
        setError(t("password_update_failed"));
      }
    } catch {
      setError(t("network_error"));
    }
    setClearingReset(false);
  }

  const title = hasPassword ? t("change_password_title") : t("set_password_title");

  if (!opened) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-1">
        <p className="text-xs font-semibold text-slate-500 uppercase">{t("account_section")}</p>
        <button onClick={() => setOpened(true)} className="text-sm text-emerald-600 font-medium">
          {title}
        </button>
        {!hasPassword && (
          <p className="text-[10px] text-slate-400">{t("set_password_hint")}</p>
        )}
        {message && <p className="text-xs text-emerald-600">{message}</p>}
      </div>
    );
  }

  if (resetting) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-red-700 uppercase">{t("reset_password_title")}</p>
        <p className="text-[11px] text-red-700">{t("reset_password_body")}</p>
        <input
          value={resetConfirm}
          onChange={(e) => setResetConfirm(e.target.value)}
          placeholder={t("reset_password_confirm_placeholder")}
          spellCheck={false}
          className="w-full px-2 py-2 rounded border border-red-300 text-sm"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleConfirmReset}
            disabled={resetConfirm !== "RESET" || clearingReset}
            className="flex-1 text-xs font-medium bg-red-600 text-white py-2 rounded-lg disabled:opacity-50"
          >
            {clearingReset ? "…" : t("reset_password_button")}
          </button>
          <button
            onClick={() => { setResetting(false); setResetConfirm(""); setError(null); }}
            className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-600 py-2 rounded-lg"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase">{title}</p>
      {hasPassword && (
        <>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("current_password")}
            autoComplete="current-password"
            className="w-full px-3 py-2 rounded border border-gray-200 text-sm"
          />
          <button
            type="button"
            onClick={() => setResetting(true)}
            className="text-[11px] text-slate-500 underline"
          >
            {t("forgot_current_password")}
          </button>
        </>
      )}
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={t("new_password")}
        autoComplete="new-password"
        minLength={8}
        maxLength={200}
        className="w-full px-3 py-2 rounded border border-gray-200 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || newPassword.length < 8 || (hasPassword && !currentPassword)}
          className="flex-1 text-xs font-medium bg-emerald-600 text-white py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? "…" : t("save_password")}
        </button>
        <button
          type="button"
          onClick={() => { setOpened(false); setCurrentPassword(""); setNewPassword(""); setError(null); }}
          className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-600 py-2 rounded-lg"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
