"use client";

import { useEffect, useState } from "react";
import SubpageLayout from "../_subpage.js";
import { useT } from "@/lib/i18n/context.js";

const CHOICES = [
  { days: 7, labelKey: "me_session_1_week" },
  { days: 14, labelKey: "me_session_2_weeks" },
  { days: 30, labelKey: "me_session_1_month" },
  { days: 90, labelKey: "me_session_3_months" },
];

export default function SessionPage() {
  const { t } = useT();
  const [sessionDays, setSessionDays] = useState(null);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (cancelled || !res.ok) return;
        const me = await res.json();
        setSessionDays(me.sessionDays || 30);
      } catch {
        if (!cancelled) setError(t("me_profile_load_failed_short"));
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function pick(d) {
    setSaving(d);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDays: d }),
      });
      if (res.ok) setSessionDays(d);
      else setError(t("me_action_fail", { action: t("save") }));
    } catch {
      setError(t("network_error"));
    }
    setSaving(null);
  }

  return (
    <SubpageLayout titleKey="me_session_duration" hintKey="me_session_duration_hint">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {CHOICES.map(({ days, labelKey }) => (
            <button
              key={days}
              onClick={() => pick(days)}
              disabled={saving === days}
              className={`text-sm px-4 py-2 rounded-full border transition-colors min-h-[36px] disabled:opacity-50 ${
                sessionDays === days
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-gray-200"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{t("me_session_duration_effect")}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </SubpageLayout>
  );
}
