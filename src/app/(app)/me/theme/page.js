"use client";

import SubpageLayout from "../_subpage.js";
import { useT } from "@/lib/i18n/context.js";
import { useTheme } from "@/lib/theme/context.js";

const SWATCH = {
  light: "bg-white border-slate-300",
  dark: "bg-slate-800 border-slate-600",
  sunrise: "bg-orange-200 border-orange-400",
  serene: "bg-sky-200 border-sky-400",
};

export default function ThemePage() {
  const { t } = useT();
  const { theme, setTheme, themes } = useTheme();

  return (
    <SubpageLayout titleKey="theme" hintKey="theme_hint">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {themes.map((th) => (
            <button
              key={th.code}
              onClick={() => setTheme(th.code)}
              className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border transition-colors min-h-[44px] ${
                theme === th.code
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-gray-200"
              }`}
            >
              <span className={`w-4 h-4 rounded-full border shrink-0 ${SWATCH[th.code] || "bg-slate-200 border-slate-300"}`} />
              <span className="truncate">{t(th.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </SubpageLayout>
  );
}
