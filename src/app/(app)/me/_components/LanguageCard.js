"use client";

import { useT } from "@/lib/i18n/context.js";
export default function LanguageCard() {
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
