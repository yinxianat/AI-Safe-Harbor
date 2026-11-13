"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { translate, LANGUAGES } from "./translations.js";

const I18nContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (key, vars) => translate("en", key, vars),
  languages: LANGUAGES,
});

const STORAGE_KEY = "leeway.locale";

function initialLocale() {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch { /* storage may be blocked */ }
  const browser = typeof navigator !== "undefined" ? navigator.language : "";
  if (browser && browser.toLowerCase().startsWith("zh")) return "zh-CN";
  return "en";
}

export function I18nProvider({ children, initial }) {
  const [locale, setLocaleState] = useState(initial || "en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!initial) setLocaleState(initialLocale());
    setHydrated(true);
  }, [initial]);

  // Sync server-side preference once we know who the user is.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.locale && LANGUAGES.some((l) => l.code === data.locale) && data.locale !== locale) {
            setLocaleState(data.locale);
            try { window.localStorage.setItem(STORAGE_KEY, data.locale); } catch { /* storage blocked */ }
          }
        }
      } catch { /* server-side preference is optional */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const setLocale = useCallback(async (newLocale) => {
    if (!LANGUAGES.some((l) => l.code === newLocale)) return;
    setLocaleState(newLocale);
    try { window.localStorage.setItem(STORAGE_KEY, newLocale); } catch { /* storage blocked */ }
    try {
      await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch { /* fine; preference stays local */ }
  }, []);

  const t = useCallback((key, vars) => translate(locale, key, vars), [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, languages: LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
