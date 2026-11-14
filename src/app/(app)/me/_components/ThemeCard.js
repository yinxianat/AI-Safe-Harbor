"use client";

import { useT } from "@/lib/i18n/context.js";
import { useTheme } from "@/lib/theme/context.js";
export default function ThemeCard() {
  const { t } = useT();
  const { theme, setTheme, themes } = useTheme();
  // Small swatch per theme so the choice is visible before committing.
  const swatch = {
    light: "bg-white border-slate-300",
    dark: "bg-slate-800 border-slate-600",
    sunrise: "bg-orange-200 border-orange-400",
    serene: "bg-sky-200 border-sky-400",
  };
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase">{t("theme")}</p>
      <p className="text-[10px] text-slate-400">{t("theme_hint")}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {themes.map((th) => (
          <button
            key={th.code}
            onClick={() => setTheme(th.code)}
            className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg border transition-colors min-h-[40px] ${
              theme === th.code
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-600 border-gray-200"
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${swatch[th.code] || "bg-slate-200 border-slate-300"}`} />
            <span className="truncate">{t(th.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
