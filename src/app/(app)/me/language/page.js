"use client";

import SubpageLayout from "../_subpage.js";
import { useT } from "@/lib/i18n/context.js";

export default function LanguagePage() {
  const { locale, setLocale, languages, t } = useT();

  return (
    <SubpageLayout titleKey="language" hintKey="me_language_hint">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4">
        <div className="flex gap-2 flex-wrap">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={`text-sm px-4 py-2 rounded-full border transition-colors min-h-[36px] ${
                locale === l.code
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-gray-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </SubpageLayout>
  );
}
