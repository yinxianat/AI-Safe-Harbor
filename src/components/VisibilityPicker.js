"use client";

import { useT } from "@/lib/i18n/context.js";

/**
 * Audience selector for anything a user shares. An empty selection means
 * "all contacts"; naming connections narrows it to exactly those people.
 *
 * This is the per-connection isolation rule made visible: the same profile
 * can show different content to different contacts.
 */
export function VisibilityPicker({ connections, selected, onChange, hint }) {
  const { t } = useT();
  if (connections.length === 0) return null;

  const isEveryone = selected.length === 0;

  function toggle(connId) {
    if (selected.includes(connId)) {
      onChange(selected.filter((id) => id !== connId));
    } else {
      onChange([...selected, connId]);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-500">{hint || t("me_visible_to")}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors min-h-[32px] ${
            isEveryone
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-slate-500 border-gray-200"
          }`}
        >
          {t("me_visible_everyone")}
        </button>
        {connections.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors min-h-[32px] ${
              selected.includes(c.id)
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-500 border-gray-200"
            }`}
          >
            {c.partnerName}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Compact read-only summary of who can see something; tap to edit. */
export function VisibilityLabel({ connections, visibleTo, onEdit }) {
  const { t } = useT();

  if (!visibleTo || visibleTo.length === 0) {
    return (
      <button onClick={onEdit} className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
        {t("me_visible_everyone")}
      </button>
    );
  }

  const names = visibleTo
    .map((id) => connections.find((c) => c.id === id)?.partnerName)
    .filter(Boolean);

  return (
    <button onClick={onEdit} className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
      {names.length > 0 ? names.join(", ") : t("me_visible_limited")}
    </button>
  );
}
