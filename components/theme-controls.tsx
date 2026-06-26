"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Moon, Paintbrush, Pipette, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_KEY = "triagedesk-theme";
const ACCENT_KEY = "triagedesk-accent";
const PREFERENCE_EVENT = "triagedesk-preferences";
const DEFAULT_ACCENT = "#879D5A";

export type ThemeMode = "dark" | "light";


const legacyAccentMap: Record<string, string> = {
  "#7b787a": "#879D5A",
  emerald: "#10b981",
  blue: "#3b82f6",
  orange: "#f97316",
  red: "#ef4444",
  violet: "#8b5cf6",
  yellow: "#eab308",
};

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function isHexColor(value: string | null): value is string {
  return Boolean(value?.match(/^#[0-9a-f]{6}$/i));
}

function normalizeAccent(value: string | null) {
  if (!value) return DEFAULT_ACCENT;
  const legacy = legacyAccentMap[value];
  if (legacy) return legacy;
  return isHexColor(value) ? value.toLowerCase() : DEFAULT_ACCENT;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function clampRgbValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(255, Math.max(0, parsed));
}

function hexFromInput(value: string) {
  const normalized = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
  return isHexColor(normalized) ? normalized.toLowerCase() : undefined;
}

function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;

  if (delta) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }

  return {
    h: Math.round((h * 60 + 360) % 360),
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToHex(h: number, s: number, v: number) {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = v - chroma;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  return rgbToHex((r + match) * 255, (g + match) * 255, (b + match) * 255);
}

function applyAccentVariables(accent: string) {
  // Single source of truth: globals.css derives --accent-soft / --accent-border
  // from --accent, so the highlight propagates system-wide in both themes.
  document.documentElement.style.setProperty("--accent", accent);
}

let cachedTheme: ThemeMode | null = null;
let cachedAccent: string | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let accentDragReleaseFrame: number | null = null;

function beginAccentDrag() {
  if (accentDragReleaseFrame !== null) {
    window.cancelAnimationFrame(accentDragReleaseFrame);
    accentDragReleaseFrame = null;
  }
  document.documentElement.dataset.accentDragging = "true";
}

function endAccentDrag() {
  if (accentDragReleaseFrame !== null) {
    window.cancelAnimationFrame(accentDragReleaseFrame);
  }

  accentDragReleaseFrame = window.requestAnimationFrame(() => {
    accentDragReleaseFrame = window.requestAnimationFrame(() => {
      delete document.documentElement.dataset.accentDragging;
      accentDragReleaseFrame = null;
    });
  });
}

function applyPreferences(theme: ThemeMode, accent: string) {
  const normalizedAccent = normalizeAccent(accent);

  cachedTheme = theme;
  cachedAccent = normalizedAccent;

  document.documentElement.dataset.theme = theme;
  applyAccentVariables(normalizedAccent);

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(ACCENT_KEY, normalizedAccent);
    } catch (e) {
      console.error(e);
    }
  }, 100);

  window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: { theme, accent: normalizedAccent } }));
}

function preferenceSnapshot() {
  if (typeof window === "undefined") return `dark:${DEFAULT_ACCENT}`;
  if (cachedTheme === null || cachedAccent === null) {
    const theme = localStorage.getItem(THEME_KEY);
    const accent = localStorage.getItem(ACCENT_KEY);
    cachedTheme = isThemeMode(theme) ? theme : "dark";
    cachedAccent = normalizeAccent(accent);
  }
  return `${cachedTheme}:${cachedAccent}`;
}

function subscribePreferences(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  function handleStorage(event: StorageEvent) {
    if (event.key === THEME_KEY || event.key === ACCENT_KEY) {
      cachedTheme = null;
      cachedAccent = null;
      callback();
    }
  }
  window.addEventListener(PREFERENCE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function usePreferences() {
  const snapshot = useSyncExternalStore(subscribePreferences, preferenceSnapshot, () => `dark:${DEFAULT_ACCENT}`);
  const separator = snapshot.indexOf(":");
  const theme = snapshot.slice(0, separator);
  const accent = snapshot.slice(separator + 1);
  return {
    theme: isThemeMode(theme) ? theme : "dark",
    accent: normalizeAccent(accent),
  };
}

export function ThemeToggle({ label = "Customize appearance" }: { label?: string }) {
  const { theme, accent } = usePreferences();
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorFieldRef = useRef<HTMLDivElement>(null);
  const hueTrackRef = useRef<HTMLDivElement>(null);
  const hsv = hexToHsv(accent);
  const rgb = hexToRgb(accent);
  const hueColor = hsvToHex(hsv.h, 1, 1);
  const hexInput = hexDraft ?? accent.toUpperCase();

  useEffect(() => {
    applyAccentVariables(accent);
  }, [accent]);

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

  function updateFromColorField(event: React.PointerEvent<HTMLDivElement>) {
    const rect = colorFieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const saturation = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const value = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setHexDraft(null);
    applyPreferences(theme, hsvToHex(hsv.h, saturation, value));
  }

  function updateFromHueTrack(event: React.PointerEvent<HTMLDivElement>) {
    const rect = hueTrackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextHue = Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * 359);
    setHexDraft(null);
    applyPreferences(theme, hsvToHex(nextHue, hsv.s, hsv.v));
  }

  function updateFromHexInput(value: string) {
    setHexDraft(value);
    const nextAccent = hexFromInput(value);
    if (nextAccent) applyPreferences(theme, nextAccent);
  }

  function updateRgbChannel(channel: "r" | "g" | "b", value: string) {
    const nextRgb = { ...rgb, [channel]: clampRgbValue(value) };
    setHexDraft(null);
    applyPreferences(theme, rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  }

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
          "h-9 w-9 shrink-0 rounded-[var(--radius-control)] border transition-colors inline-flex items-center justify-center",
          open
            ? "border-accent-border bg-accent-soft text-accent"
            : "border-border bg-surface text-muted hover:bg-surface-hover hover:text-fg"
        )}
      >
        <Paintbrush size={16} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Appearance"
          className="app-dropdown-enter fixed left-4 right-4 top-[4.25rem] z-[100] rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[min(21rem,calc(100vw-2rem))]"
        >
          <div className="mb-4">
            <div className="text-sm font-medium text-fg">Appearance</div>
            <div className="text-xs text-muted mt-0.5">Theme and accent color</div>
          </div>

          <div className="relative mb-4 grid grid-cols-2 gap-1 overflow-hidden rounded-[var(--radius-control)] border border-border bg-bg p-1">
            <div
              className={cn(
                "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-[6px] bg-accent transition-transform duration-300 ease-out",
                theme === "light" ? "translate-x-full" : "translate-x-0"
              )}
            />
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
                    "relative z-10 h-9 rounded-[6px] text-sm font-medium transition-colors duration-200 inline-flex items-center justify-center gap-2",
                    theme === option.value ? "text-accent-fg" : "text-muted hover:text-fg"
                  )}
                >
                  <Icon size={14} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-[var(--radius-control)] border border-border bg-bg p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Accent</div>
              <div className="text-xs text-faint">Drag or type a value</div>
            </div>

            <div
              ref={colorFieldRef}
              role="slider"
              tabIndex={0}
              aria-label="Accent saturation and brightness"
              aria-valuenow={Math.round(hsv.s * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={accent}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                beginAccentDrag();
                updateFromColorField(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1) updateFromColorField(event);
              }}
              onPointerUp={(event) => {
                updateFromColorField(event);
                endAccentDrag();
              }}
              onPointerCancel={endAccentDrag}
              onLostPointerCapture={endAccentDrag}
              className="relative h-44 cursor-crosshair overflow-hidden rounded-[6px] ring-1 ring-inset ring-border"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
              }}
            >
              <span
                className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: accent }}
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Pipette size={16} className="shrink-0 text-muted" />
              <div
                ref={hueTrackRef}
                role="slider"
                tabIndex={0}
                aria-label="Accent hue"
                aria-valuenow={hsv.h}
                aria-valuemin={0}
                aria-valuemax={359}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  beginAccentDrag();
                  updateFromHueTrack(event);
                }}
                onPointerMove={(event) => {
                  if (event.buttons === 1) updateFromHueTrack(event);
                }}
                onPointerUp={(event) => {
                  updateFromHueTrack(event);
                  endAccentDrag();
                }}
                onPointerCancel={endAccentDrag}
                onLostPointerCapture={endAccentDrag}
                className="relative h-3 flex-1 cursor-pointer rounded-full ring-1 ring-inset ring-border"
                style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
              >
                <span
                  className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
                  style={{ left: `${(hsv.h / 359) * 100}%`, backgroundColor: hueColor }}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="grid grid-cols-1 gap-2">
                <label className="sr-only" htmlFor="accent-hex">Hex color</label>
                <input
                  id="accent-hex"
                  value={hexInput}
                  onChange={(event) => updateFromHexInput(event.target.value)}
                  onBlur={() => setHexDraft(null)}
                  spellCheck={false}
                  className="h-9 rounded-[6px] border border-border bg-surface px-3 font-mono text-sm text-fg focus:outline-none focus:border-accent-border"
                  aria-label="Hex color"
                />
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["r", "R", rgb.r],
                    ["g", "G", rgb.g],
                    ["b", "B", rgb.b],
                  ] as const).map(([channel, label, value]) => (
                    <label key={channel} className="flex h-9 items-center gap-1 rounded-[6px] border border-border bg-surface px-2 font-mono text-sm text-muted">
                      <span className="font-medium">{label}</span>
                      <input
                        value={value}
                        type="number"
                        min={0}
                        max={255}
                        inputMode="numeric"
                        onChange={(event) => updateRgbChannel(channel, event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-right text-fg focus:outline-none"
                        aria-label={`${label} channel`}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="h-9 w-9 rounded-[6px] border border-border" style={{ backgroundColor: accent }} />
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setHexDraft(null);
                applyPreferences(theme, DEFAULT_ACCENT);
              }}
              className="w-full h-9 rounded-[var(--radius-control)] border border-border bg-bg hover:bg-surface-hover text-xs font-medium text-muted hover:text-fg transition-colors duration-200"
            >
              Set to default
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
