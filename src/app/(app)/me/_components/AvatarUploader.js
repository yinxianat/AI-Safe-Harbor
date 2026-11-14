"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/context.js";
import Avatar, { fileToAvatarDataUrl } from "@/components/Avatar.js";
export default function AvatarUploader({ profile, onChange }) {
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
