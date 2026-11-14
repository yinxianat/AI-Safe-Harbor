"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SubpageLayout from "../_subpage.js";
import { useT } from "@/lib/i18n/context.js";
import { VisibilityPicker } from "@/components/VisibilityPicker.js";

/**
 * Status subpage.
 *
 * Moved out of the Me index so the status card gets room to breathe —
 * the audience picker was squeezed into a tiny strip when it was sharing
 * the index page with nine other sections. An audience is the main thing
 * someone tunes on a status.
 */
export default function StatusPage() {
  const { t } = useT();

  const [statusText, setStatusText] = useState("");
  const [visibility, setVisibility] = useState([]);
  const [connections, setConnections] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch("/api/status"),
          fetch("/api/connections"),
        ]);
        if (cancelled) return;
        if (sRes.ok) {
          const s = await sRes.json();
          setStatusText(s.statusText || "");
          setVisibility(s.statusVisibleTo || []);
        }
        if (cRes.ok) setConnections((await cRes.json()).connections || []);
      } catch {
        if (!cancelled) setError(t("me_profile_load_failed_short"));
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statusText,
          // Mood was removed earlier; the shape still expects it.
          statusMood: null,
          statusVisibleTo: visibility,
        }),
      });
      if (!res.ok) {
        setError(t("me_action_fail", { action: t("me_action_save_status") }));
      } else {
        setDirty(false);
        setSavedAt(Date.now());
      }
    } catch {
      setError(t("me_action_network_fail", { action: t("me_action_save_status") }));
    }
    setSaving(false);
  }

  return (
    <SubpageLayout titleKey="me_status_section" hintKey="me_status_visibility_hint">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-3">
        <input
          value={statusText}
          onChange={(e) => { setStatusText(e.target.value); setDirty(true); }}
          placeholder={t("me_status_placeholder")}
          maxLength={200}
          spellCheck
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {connections.length > 0 && (
          <div className="pt-1 border-t border-gray-100 space-y-2">
            <VisibilityPicker
              connections={connections}
              selected={visibility}
              onChange={(v) => { setVisibility(v); setDirty(true); }}
              hint={t("me_status_visibility_hint")}
            />
            <Link href="/me/audience" className="inline-block text-xs font-medium text-emerald-600">
              {t("me_status_preview_link")}
            </Link>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? "…" : t("save")}
          </button>
          {savedAt && !dirty && (
            <p className="text-xs text-emerald-600">{t("saved")}</p>
          )}
        </div>
      </div>
    </SubpageLayout>
  );
}
