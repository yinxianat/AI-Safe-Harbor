"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context.js";
/**
 * Reader-side emotional shield.
 *
 * Controls stored on the User row and applied by every read path that
 * surfaces someone else's words (status, wall posts, Know Me, messages).
 * On by default — a new account starts shielded for every registered
 * emotion — so a user never has to opt in to be protected the first time
 * their contact writes something heated.
 *
 * Every toggle saves immediately: this is a preference surface, not a
 * form, so a Save button would get skipped and then nothing would
 * actually persist. Save confirmation is inline per control.
 */
export default function ShieldCard() {
  const { t } = useT();
  const [enabled, setEnabled] = useState(null);
  const [emotions, setEmotions] = useState([]);
  const [allEmotions, setAllEmotions] = useState([]);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/shield");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setEnabled(Boolean(data.enabled));
        setEmotions(data.emotions || []);
        setAllEmotions(data.allEmotions || []);
      } catch {
        if (!cancelled) setError(t("network_error"));
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function save(next, key) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/settings/shield", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        setError(t("shield_save_failed"));
      } else {
        const data = await res.json();
        setEnabled(Boolean(data.enabled));
        setEmotions(data.emotions || []);
      }
    } catch {
      setError(t("network_error"));
    }
    setSaving(null);
  }

  function toggleEmotion(key) {
    const next = emotions.includes(key)
      ? emotions.filter((e) => e !== key)
      : [...emotions, key];
    setEmotions(next);
    save({ emotions: next }, `e:${key}`);
  }

  if (enabled === null) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase">{t("shield_title")}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{t("shield_hint")}</p>
        </div>
        <label className="flex items-center gap-2 shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              save({ enabled: e.target.checked }, "enabled");
            }}
            className="h-4 w-4 accent-emerald-600"
          />
          <span className="text-xs text-slate-600">
            {saving === "enabled" ? t("saving") : enabled ? t("shield_on") : t("shield_off")}
          </span>
        </label>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {enabled && (
        <>
          <p className="text-[11px] text-slate-500">{t("shield_emotions_hint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {allEmotions.map((key) => {
              const on = emotions.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleEmotion(key)}
                  disabled={saving === `e:${key}`}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors min-h-[28px] disabled:opacity-50 ${
                    on
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-500 border-gray-200"
                  }`}
                >
                  {t(`emotion_${key}`)}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400">{t("shield_crisis_note")}</p>
        </>
      )}
    </div>
  );
}
