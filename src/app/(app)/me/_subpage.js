"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";

/**
 * Shared chrome for the Me-section sub-pages (/me/theme, /me/language, …).
 *
 * All six subpages share a header shape — a "← Me" link, a title, and
 * one explanatory sentence — and used to render them separately. Putting
 * the chrome here keeps the subpages themselves as the control they are
 * about, so a reviewer can see what each page does without scrolling past
 * the identical scaffolding.
 */
export default function SubpageLayout({ titleKey, hintKey, children }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <Link href="/me" className="text-sm font-medium text-emerald-600">
        ← {t("nav_me")}
      </Link>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t(titleKey)}</h1>
        {hintKey && (
          <p className="mt-1 text-sm text-slate-500">{t(hintKey)}</p>
        )}
      </div>
      {children}
    </div>
  );
}
