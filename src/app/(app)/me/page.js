"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import { useTheme } from "@/lib/theme/context.js";
import Avatar, { fileToAvatarDataUrl } from "@/components/Avatar.js";
import { VisibilityPicker } from "@/components/VisibilityPicker.js";

const MOOD_OPTIONS = ["calm", "happy", "energetic", "low", "neutral"];

export default function MePage() {
  const router = useRouter();
  const { t } = useT();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusText, setStatusText] = useState("");
  const [statusMood, setStatusMood] = useState("neutral");
  const [statusVisibility, setStatusVisibility] = useState([]);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusDirty, setStatusDirty] = useState(false);

  const [storyCount, setStoryCount] = useState(0);
  const [knowMeCount, setKnowMeCount] = useState(0);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const [connections, setConnections] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meRes, statusRes, knowMeRes, wallRes, connRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/status"),
          fetch("/api/knowme"),
          fetch("/api/wall"),
          fetch("/api/connections"),
        ]);
        if (cancelled) return;
        if (meRes.ok) {
          const me = await meRes.json();
          setProfile(me);
          setNameInput(me.displayName || "");
        } else {
          setError(t("me_profile_load_failed"));
        }
        if (statusRes.ok) {
          const s = await statusRes.json();
          setStatusText(s.statusText || "");
          setStatusMood(s.statusMood || "neutral");
          setStatusVisibility(s.statusVisibleTo || []);
        }
        if (knowMeRes.ok) setKnowMeCount(((await knowMeRes.json()).entries || []).length);
        if (wallRes.ok) setStoryCount(((await wallRes.json()).posts || []).length);
        if (connRes.ok) setConnections((await connRes.json()).connections || []);
      } catch {
        if (!cancelled) setError(t("me_profile_load_failed_short"));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function handleSaveStatus() {
    setStatusSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusText, statusMood, statusVisibleTo: statusVisibility }),
      });
      if (res.ok) setStatusDirty(false);
      else setError(t("me_action_fail", { action: t("me_action_save_status") }));
    } catch {
      setError(t("me_action_network_fail", { action: t("me_action_save_status") }));
    }
    setStatusSaving(false);
  }

  async function handleSaveName() {
    setNameSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameInput.trim() }),
      });
      if (res.ok) { setProfile(await res.json()); setEditingName(false); }
      else setError(t("me_action_fail", { action: t("me_action_save_name") }));
    } catch {
      setError(t("me_action_network_fail", { action: t("me_action_save_name") }));
    }
    setNameSaving(false);
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch { /* sign-out local-only anyway */ }
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium underline mt-1">{t("dismiss")}</button>
        </div>
      )}

      {/* --- Header: Avatar + Name + Username --- */}
      <div className="flex items-start gap-3 sm:gap-4">
        <AvatarUploader
          profile={profile}
          onChange={(avatarUrl) => setProfile((p) => ({ ...p, avatarUrl }))}
        />
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                spellCheck
                className="px-2 py-1 rounded-lg border border-gray-200 text-base sm:text-lg font-bold w-36 sm:w-40"
                autoFocus
              />
              <button onClick={handleSaveName} disabled={nameSaving} className="text-sm font-medium text-emerald-600">
                {nameSaving ? "…" : t("save")}
              </button>
              <button onClick={() => { setEditingName(false); setNameInput(profile?.displayName || ""); }} className="text-sm text-slate-400">
                {t("cancel")}
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {profile?.displayName || t("me_fallback_name")}
              </h1>
              <button onClick={() => setEditingName(true)} className="text-xs text-emerald-600 shrink-0">{t("edit")}</button>
            </div>
          )}
          {profile?.username && (
            <p className="text-sm text-slate-500 truncate">@{profile.username}</p>
          )}
          {profile?.email && (
            <p className="text-xs text-slate-400 truncate">{profile.email}</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-red-500 font-medium shrink-0"
        >
          {t("sign_out")}
        </button>
      </div>

      {/* --- Status --- */}
      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">{t("me_status_section")}</p>
        <input
          value={statusText}
          onChange={(e) => { setStatusText(e.target.value); setStatusDirty(true); }}
          placeholder={t("me_status_placeholder")}
          maxLength={200}
          spellCheck
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex gap-1 flex-wrap">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => { setStatusMood(m); setStatusDirty(true); }}
              className={`text-xs px-2.5 py-1.5 rounded-full transition-colors min-h-[32px] ${
                statusMood === m
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-slate-500"
              }`}
            >
              {t(`mood_${m}`)}
            </button>
          ))}
        </div>
        {connections.length > 0 && (
          <div className="pt-1 border-t border-gray-100">
            <VisibilityPicker
              connections={connections}
              selected={statusVisibility}
              onChange={(v) => { setStatusVisibility(v); setStatusDirty(true); }}
              hint={t("me_status_visibility_hint")}
            />
          </div>
        )}
        {statusDirty && (
          <button
            onClick={handleSaveStatus}
            disabled={statusSaving}
            className="w-full bg-emerald-600 text-white text-xs font-medium py-2 rounded-lg disabled:opacity-50"
          >
            {statusSaving ? "…" : t("save")}
          </button>
        )}
      </div>

      {/* --- Links out to the self-description pages --- */}
      <div className="space-y-2">
        <SectionLink
          href="/story"
          title={t("me_open_story")}
          hint={t("me_open_story_hint", { count: storyCount })}
        />
        <SectionLink
          href="/knowme"
          title={t("me_open_knowme")}
          hint={t("me_open_knowme_hint", { count: knowMeCount })}
        />
      </div>

      <ThemeCard />
      <LanguageCard />
      <PasswordCard />
      <DeleteAccountCard />

      {/* --- Session Duration --- */}
      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">{t("me_session_duration")}</p>
        <p className="text-[10px] text-slate-400">{t("me_session_duration_hint")}</p>
        <div className="flex gap-1.5 flex-wrap">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={async () => {
                await fetch("/api/auth/me", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sessionDays: d }),
                });
                setProfile((p) => ({ ...p, sessionDays: d }));
              }}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors min-h-[32px] ${
                (profile?.sessionDays || 30) === d
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-500 border-gray-200"
              }`}
            >
              {d === 7 ? t("me_session_1_week") : d === 14 ? t("me_session_2_weeks") : d === 30 ? t("me_session_1_month") : t("me_session_3_months")}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">{t("me_session_duration_effect")}</p>
      </div>
    </div>
  );
}

function SectionLink({ href, title, hint }) {
  const { t } = useT();
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-100 p-3 active:bg-slate-50 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-400 truncate">{hint}</p>
      </div>
      <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-label={t("me_open_arrow")}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function AvatarUploader({ profile, onChange }) {
  const { t } = useT();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handlePick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setError(t("avatar_invalid"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Resize client-side; the server rejects anything over ~300 KB so an
      // original phone photo would otherwise always fail.
      const dataUrl = await fileToAvatarDataUrl(file);
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (res.ok) {
        const updated = await res.json();
        onChange(updated.avatarUrl);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error === "avatar_too_large" ? t("avatar_too_large") : t("avatar_failed"));
      }
    } catch {
      setError(t("avatar_failed"));
    }
    setBusy(false);
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (res.ok) onChange(null);
      else setError(t("avatar_failed"));
    } catch {
      setError(t("avatar_failed"));
    }
    setBusy(false);
  }

  return (
    <div className="shrink-0 space-y-1">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="block relative rounded-full disabled:opacity-50"
        aria-label={profile?.avatarUrl ? t("avatar_change") : t("avatar_add")}
      >
        <Avatar src={profile?.avatarUrl} name={profile?.displayName || profile?.username} size="lg" />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] leading-5 text-center border-2 border-white">
          +
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handlePick}
        className="hidden"
      />
      {busy && <p className="text-[10px] text-slate-400">{t("avatar_uploading")}</p>}
      {profile?.avatarUrl && !busy && (
        <button onClick={handleRemove} className="text-[10px] text-slate-400 underline">
          {t("avatar_remove")}
        </button>
      )}
      {error && <p className="text-[10px] text-red-600 max-w-[72px]">{error}</p>}
    </div>
  );
}

function ThemeCard() {
  const { t } = useT();
  const { theme, setTheme, themes } = useTheme();
  // Small swatch per theme so the choice is visible before committing.
  const swatch = {
    light: "bg-white border-slate-300",
    dark: "bg-slate-800 border-slate-600",
    sunrise: "bg-orange-200 border-orange-400",
    serene: "bg-sky-200 border-sky-400",
  };
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase">{t("theme")}</p>
      <p className="text-[10px] text-slate-400">{t("theme_hint")}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {themes.map((th) => (
          <button
            key={th.code}
            onClick={() => setTheme(th.code)}
            className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg border transition-colors min-h-[40px] ${
              theme === th.code
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-600 border-gray-200"
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${swatch[th.code] || "bg-slate-200 border-slate-300"}`} />
            <span className="truncate">{t(th.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LanguageCard() {
  const { locale, setLocale, languages, t } = useT();
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase">{t("language")}</p>
      <div className="flex gap-1.5">
        {languages.map((l) => (
          <button
            key={l.code}
            onClick={() => setLocale(l.code)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[32px] ${
              locale === l.code
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-500 border-gray-200"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PasswordCard() {
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

function DeleteAccountCard() {
  const router = useRouter();
  const { t } = useT();
  const [opened, setOpened] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

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

  if (!opened) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3">
        <button
          onClick={() => setOpened(true)}
          className="text-xs text-red-500 font-medium"
        >
          {t("me_delete_my_account")}
        </button>
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
        className="w-full px-2 py-2 rounded border border-red-300 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={confirmText !== "DELETE" || deleting}
          className="flex-1 text-xs font-medium bg-red-600 text-white py-2 rounded-lg disabled:opacity-50"
        >
          {deleting ? t("me_deleting") : t("me_delete_forever")}
        </button>
        <button
          onClick={() => { setOpened(false); setConfirmText(""); setError(null); }}
          className="flex-1 text-xs font-medium bg-white border border-gray-200 text-slate-600 py-2 rounded-lg"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
