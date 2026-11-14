"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import AvatarUploader from "./_components/AvatarUploader.js";

/**
 * The Me index is a mini-menu.
 *
 * Each row explains in one line what the section does and takes the user
 * to a focused subpage. Previously every setting — status, theme,
 * language, password, delete-account, session, shield — rendered its
 * full UI on this one page, which made the screen scroll for a long
 * time and buried the serious sections (password, delete) under the
 * casual ones. A menu is how a settings screen earns its keep: a
 * reader can find the section they want in one glance.
 */

const SECTIONS = [
  { href: "/me/audience", titleKey: "me_open_audience", hintKey: "me_open_audience_hint_short" },
  { href: "/story", titleKey: "me_open_story", hintKey: "me_open_story_hint_short" },
  { href: "/knowme", titleKey: "me_open_knowme", hintKey: "me_open_knowme_hint_short" },
  { href: "/me/status", titleKey: "me_status_section", hintKey: "me_section_status_hint" },
  { href: "/me/shield", titleKey: "shield_title", hintKey: "me_section_shield_hint" },
  { href: "/me/theme", titleKey: "theme", hintKey: "me_section_theme_hint" },
  { href: "/me/language", titleKey: "language", hintKey: "me_section_language_hint" },
  { href: "/me/session", titleKey: "me_session_duration", hintKey: "me_section_session_hint" },
  { href: "/me/account", titleKey: "account_section", hintKey: "me_section_account_hint" },
];

export default function MePage() {
  const router = useRouter();
  const { t } = useT();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (cancelled) return;
        if (res.ok) {
          const me = await res.json();
          setProfile(me);
          setNameInput(me.displayName || "");
        } else {
          setError(t("me_profile_load_failed"));
        }
      } catch {
        if (!cancelled) setError(t("me_profile_load_failed_short"));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function handleSaveName() {
    setNameSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nameInput.trim() }),
      });
      if (res.ok) {
        setProfile(await res.json());
        setEditingName(false);
      } else {
        setError(t("me_action_fail", { action: t("me_action_save_name") }));
      }
    } catch {
      setError(t("me_action_network_fail", { action: t("me_action_save_name") }));
    }
    setNameSaving(false);
  }

  async function handleSignOut() {
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch { /* sign-out is local-only anyway */ }
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

      {/* Header: avatar, name, sign-out — the stuff tied to the user's
          identity rather than any one setting. */}
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
        <button onClick={handleSignOut} className="text-xs text-red-500 font-medium shrink-0">
          {t("sign_out")}
        </button>
      </div>

      {/* Menu. One row per section, each a link. */}
      <nav className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-start gap-3 px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-slate-50 active:bg-slate-50 transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold text-slate-800">{t(section.titleKey)}</p>
              <p className="text-[11px] text-slate-500 line-clamp-2">{t(section.hintKey)}</p>
            </div>
            <svg className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </nav>
    </div>
  );
}
