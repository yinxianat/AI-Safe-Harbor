"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context.js";

/**
 * Shown next to a compose result when the sender's draft reads as a cry
 * for help (self-harm, abuse, danger).
 *
 * The content is deliberately brief and non-clinical: the app is the wrong
 * place to try to help with a crisis itself. All it needs to do is hand
 * the user a next step and not get in the way.
 *
 * Loaded from /api/crisis-resources rather than hardcoded so the list can
 * be changed in one place without redeploying the UI.
 */
export default function CrisisCard({ onDismiss }) {
  const { t } = useT();
  const [resources, setResources] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/crisis-resources");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setResources(data.resources || []);
      } catch {
        // No resources list is not the end of the world — the title
        // and the body message are the main point. Fall back to empty
        // state silently.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xl shrink-0" aria-hidden="true">💛</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-900">
            {t("crisis_title")}
          </p>
          <p className="mt-0.5 text-xs text-emerald-800">
            {t("crisis_body")}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-emerald-700 shrink-0"
            aria-label={t("crisis_dismiss")}
          >
            ✕
          </button>
        )}
      </div>
      {resources.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-emerald-200">
          {resources.map((r) => (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg bg-white border border-emerald-200 p-2 hover:bg-emerald-100 transition-colors"
            >
              <p className="text-xs font-medium text-emerald-900">
                {t(r.labelKey)}
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5">
                {t(r.descriptionKey)}
              </p>
            </a>
          ))}
        </div>
      )}
      <p className="text-[10px] text-emerald-700/80">
        {t("crisis_footer")}
      </p>
    </div>
  );
}
