"use client";

import { useT } from "./i18n/context.js";

/**
 * "2 minutes ago" / "3 hours ago" / "yesterday"-style relative time, in the
 * active locale.
 *
 * Returned as a hook rather than a plain function because every string it
 * emits is a translation key. The previous copy lived inside the circle page,
 * so the chat list could not use it without duplicating the key list — and a
 * duplicate drifts the first time either side adds a locale.
 */
export function useTimeAgo() {
  const { t } = useT();
  return (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("circle_time_just_now");
    if (mins < 60) return t("circle_time_minutes", { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("circle_time_hours", { n: hrs });
    return t("circle_time_days", { n: Math.floor(hrs / 24) });
  };
}
