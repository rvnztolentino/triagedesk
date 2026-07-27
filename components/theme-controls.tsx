"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "triagedesk-theme";
const THEME_EVENT = "triagedesk-theme-change";
const DEFAULT_THEME: ThemeMode = "dark";

export type ThemeMode = "dark" | "light";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

let cachedTheme: ThemeMode | null = null;

function applyTheme(theme: ThemeMode) {
  cachedTheme = theme;
  // The accent color is derived from the theme in globals.css (white on dark,
  // black on light), so switching the mode is the only thing to persist.
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.error(e);
  }

  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}

function themeSnapshot(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME;
  if (cachedTheme === null) {
    const stored = localStorage.getItem(THEME_KEY);
    cachedTheme = isThemeMode(stored) ? stored : DEFAULT_THEME;
  }
  return cachedTheme;
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  function handleStorage(event: StorageEvent) {
    if (event.key === THEME_KEY) {
      cachedTheme = null;
      callback();
    }
  }
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function useTheme() {
  return useSyncExternalStore(subscribeTheme, themeSnapshot, () => DEFAULT_THEME);
}

// A two-state switch: the thumb slides between a sun (light) and a moon (dark)
// slot, and carries the accent color so the active mode reads at a glance.
export function ThemeToggle() {
  const theme = useTheme();
  const isDark = theme === "dark";
  const nextTheme: ThemeMode = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={`Switch to ${nextTheme} mode`}
      onClick={() => applyTheme(nextTheme)}
      className="theme-switch"
    >
      <span className="theme-switch-thumb" aria-hidden />
      <span className="theme-switch-icon theme-switch-icon--sun" aria-hidden>
        <Sun size={14} />
      </span>
      <span className="theme-switch-icon theme-switch-icon--moon" aria-hidden>
        <Moon size={14} />
      </span>
    </button>
  );
}
