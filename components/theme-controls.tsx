"use client";

import { useSyncExternalStore } from "react";
import { Moon, SunDim } from "lucide-react";

const THEME_KEY = "triagedesk-theme";
const THEME_EVENT = "triagedesk-theme-change";
const SYSTEM_LIGHT_QUERY = "(prefers-color-scheme: light)";
const DEFAULT_THEME: ThemeMode = "dark";

export type ThemeMode = "dark" | "light";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

let cachedTheme: ThemeMode | null = null;

function storedTheme(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

// Follows the OS setting. Dark is the fallback when the browser cannot report one.
function systemTheme(): ThemeMode {
  try {
    return window.matchMedia(SYSTEM_LIGHT_QUERY).matches ? "light" : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function resolveTheme(): ThemeMode {
  return storedTheme() ?? systemTheme();
}

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
  if (cachedTheme === null) cachedTheme = resolveTheme();
  return cachedTheme;
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  function resync() {
    cachedTheme = resolveTheme();
    document.documentElement.dataset.theme = cachedTheme;
    callback();
  }
  function handleStorage(event: StorageEvent) {
    if (event.key === THEME_KEY) resync();
  }
  // Only matters until the visitor picks a mode; after that the saved choice wins.
  function handleSystemChange() {
    if (storedTheme() === null) resync();
  }

  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia(SYSTEM_LIGHT_QUERY);
  } catch {
    media = null;
  }

  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  media?.addEventListener("change", handleSystemChange);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
    media?.removeEventListener("change", handleSystemChange);
  };
}

function useTheme() {
  return useSyncExternalStore(subscribeTheme, themeSnapshot, () => DEFAULT_THEME);
}

// A round icon button for the workspace header, sized like the controls beside
// it. The icon names the active mode (moon for dark, sun for light).
export function ThemeButton() {
  const theme = useTheme();
  const isDark = theme === "dark";
  const nextTheme: ThemeMode = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => applyTheme(nextTheme)}
      className="shell-ctrl h-10 w-10 text-muted hover:text-fg"
    >
      {isDark ? <Moon size={16} /> : <SunDim size={18} />}
    </button>
  );
}

// A two-state monochrome switch: the thumb covers one slot and the icon in the
// other slot names the active mode (sun on the left for light, moon on the
// right for dark).
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
        <SunDim size={14} />
      </span>
      <span className="theme-switch-icon theme-switch-icon--moon" aria-hidden>
        <Moon size={12} />
      </span>
    </button>
  );
}
