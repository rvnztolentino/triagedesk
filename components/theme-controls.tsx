"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Moon, Paintbrush, Sun } from "lucide-react";
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

export function ThemeToggle({ label = "Customize appearance" }: { label?: string }) {
  const { theme, accent } = usePreferences();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "h-10 w-10 shrink-0 rounded-full border transition-colors inline-flex items-center justify-center",
          open
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-neutral-800 bg-[#111111] text-neutral-400 hover:bg-neutral-800 hover:text-white"
        )}
      >
        <Paintbrush size={17} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Appearance"
          className="fixed left-4 right-4 top-[4.5rem] z-50 rounded-2xl border border-neutral-800 bg-[#111111] p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(21rem,calc(100vw-2rem))]"
        >
          <div className="mb-4">
            <div className="text-sm font-semibold text-white">Appearance</div>
            <div className="text-xs text-neutral-500 mt-0.5">Theme and accent color</div>
          </div>

          <div className="mb-4 rounded-full border border-neutral-800 bg-[#0a0a0a] p-1 grid grid-cols-2 gap-1">
            {([
              { value: "dark", label: "Dark", icon: Moon },
              { value: "light", label: "Light", icon: Sun },
            ] as const).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => applyPreferences(option.value, accent)}
                  className={cn(
                    "h-10 rounded-full text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2",
                    theme === option.value ? "bg-emerald-500 text-black" : "text-neutral-500 hover:text-white"
                  )}
                >
                  <Icon size={15} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {accentOptions.map((option) => {
              const selected = accent === option.value;
              return (
              <button
                key={option.value}
                type="button"
                onClick={() => applyPreferences(theme, option.value)}
                className={cn(
                  "h-11 rounded-full border px-3 text-left text-sm font-semibold transition-colors flex items-center gap-3",
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 text-white"
                    : "border-neutral-800 bg-[#0a0a0a] text-neutral-400 hover:text-white"
                )}
              >
                <span className="h-5 w-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: option.swatch }} />
                <span className="flex-1">{option.label}</span>
                {selected ? <Check size={15} className="text-emerald-400" /> : null}
              </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
