"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

/**
 * Theme names must match the data-theme values in globals.css. A new theme
 * is added by adding the CSS block there and registering a label here.
 */
export const THEMES = [
  { code: "light", labelKey: "theme_light" },
  { code: "dark", labelKey: "theme_dark" },
  { code: "sunrise", labelKey: "theme_sunrise" },
  { code: "serene", labelKey: "theme_serene" },
];

const VALID = new Set(THEMES.map((t) => t.code));
const STORAGE_KEY = "leeway.theme";

const ThemeContext = createContext({
  theme: "light",
  setTheme: () => {},
  themes: THEMES,
});

function readStored() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored)) return stored;
  } catch { /* storage may be blocked */ }
  // Honor system preference as a nicer default — dark looks less jarring
  // for a first-time visitor using dark mode OS-wide.
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children, initial }) {
  const [theme, setThemeState] = useState(initial || "light");

  // Apply initial theme ASAP. useState initializer runs on server too, so
  // we can't read localStorage there — do it in an effect that fires
  // before paint on the client.
  useEffect(() => {
    setThemeState(readStored());
  }, []);

  // Keep the data-theme attribute in sync with state.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Pull the server-stored preference once we know who the user is. Only
  // override local state if the server actually has a value — otherwise the
  // user's offline pick wins.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.theme && VALID.has(data.theme) && data.theme !== theme) {
            setThemeState(data.theme);
            try { window.localStorage.setItem(STORAGE_KEY, data.theme); } catch { /* storage blocked */ }
          }
        }
      } catch { /* server-side preference is optional */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback(async (newTheme) => {
    if (!VALID.has(newTheme)) return;
    setThemeState(newTheme);
    try { window.localStorage.setItem(STORAGE_KEY, newTheme); } catch { /* storage blocked */ }
    try {
      await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch { /* fine; preference stays local */ }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
