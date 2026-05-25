"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_KEY = "triagedesk-theme";
const ACCENT_KEY = "triagedesk-accent";
const PREFERENCE_EVENT = "triagedesk-preferences";

export type ThemeMode = "dark" | "light";
export type AccentColor = "emerald" | "blue" | "orange" | "red" | "violet" | "yellow";

export const accentOptions: Array<{ value: AccentColor; label: string; swatch: string }> = [
  { value: "emerald", label: "Green", swatch: "#10b981" },
  { value: "blue", label: "Blue", swatch: "#3b82f6" },
  { value: "orange", label: "Orange", swatch: "#f97316" },
  { value: "red", label: "Red", swatch: "#ef4444" },
  { value: "violet", label: "Violet", swatch: "#8b5cf6" },
  { value: "yellow", label: "Yellow", swatch: "#eab308" },
];

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function isAccentColor(value: string | null): value is AccentColor {
  return accentOptions.some((option) => option.value === value);
}

function applyPreferences(theme: ThemeMode, accent: AccentColor) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(ACCENT_KEY, accent);
  window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: { theme, accent } }));
}

function preferenceSnapshot() {
  if (typeof window === "undefined") return "dark:emerald";
  const theme = localStorage.getItem(THEME_KEY);
  const accent = localStorage.getItem(ACCENT_KEY);
  return `${isThemeMode(theme) ? theme : "dark"}:${isAccentColor(accent) ? accent : "emerald"}`;
}

function subscribePreferences(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  function handleStorage(event: StorageEvent) {
    if (event.key === THEME_KEY || event.key === ACCENT_KEY) callback();
  }
  window.addEventListener(PREFERENCE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function usePreferences() {
  const snapshot = useSyncExternalStore(subscribePreferences, preferenceSnapshot, () => "dark:emerald");
  const [theme, accent] = snapshot.split(":");
  return {
    theme: isThemeMode(theme) ? theme : "dark",
    accent: isAccentColor(accent) ? accent : "emerald",
  };
}

export function ThemeToggle({ label = "Toggle color theme" }: { label?: string }) {
  const { theme, accent } = usePreferences();

  const isLight = theme === "light";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        const nextTheme = isLight ? "dark" : "light";
        applyPreferences(nextTheme, accent);
      }}
      className="h-9 w-9 shrink-0 rounded-lg border border-neutral-800 bg-[#111111] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
    >
      <span className="flex h-full w-full items-center justify-center">
        {isLight ? <Moon size={17} /> : <Sun size={17} />}
      </span>
    </button>
  );
}

export function ThemeSettingsPanel() {
  const { theme, accent } = usePreferences();

  return (
    <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
      <div className="mb-5">
        <h2 className="font-semibold text-white">Appearance</h2>
        <p className="text-sm text-neutral-500 mt-1">Choose the workspace theme and accent color.</p>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Theme</div>
          <div className="inline-flex rounded-xl border border-neutral-800 bg-[#0a0a0a] p-1">
            {(["dark", "light"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => applyPreferences(mode, accent)}
                className={cn(
                  "h-9 px-4 rounded-lg text-sm font-bold capitalize transition-colors",
                  theme === mode ? "bg-emerald-500 text-black" : "text-neutral-500 hover:text-white"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Accent Color</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accentOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => applyPreferences(theme, option.value)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold transition-colors",
                  accent === option.value
                    ? "border-emerald-500 bg-emerald-500/10 text-white"
                    : "border-neutral-800 bg-[#0a0a0a] text-neutral-400 hover:text-white"
                )}
              >
                <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: option.swatch }} />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
