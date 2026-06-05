"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Moon, Paintbrush, Pipette, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_KEY = "triagedesk-theme";
const ACCENT_KEY = "triagedesk-accent";
const PREFERENCE_EVENT = "triagedesk-preferences";
const DEFAULT_ACCENT = "#10b981";

export type ThemeMode = "dark" | "light";

const presetAccents = [
  { label: "Green", value: "#10b981" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Orange", value: "#f97316" },
  { label: "Red", value: "#ef4444" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Yellow", value: "#eab308" },
] as const;

const legacyAccentMap: Record<string, string> = {
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
  const root = document.documentElement;
  const hsv = hexToHsv(accent);
  root.dataset.accent = "custom";
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-strong", hsvToHex(hsv.h, Math.min(1, hsv.s + 0.08), Math.max(0.62, hsv.v - 0.1)));
  root.style.setProperty("--accent-text", accent);
  root.style.setProperty("--accent-border", `color-mix(in srgb, ${accent} 30%, transparent)`);
}

function applyPreferences(theme: ThemeMode, accent: string) {
  const normalizedAccent = normalizeAccent(accent);
  document.documentElement.dataset.theme = theme;
  applyAccentVariables(normalizedAccent);
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(ACCENT_KEY, normalizedAccent);
  window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: { theme, accent: normalizedAccent } }));
}

function preferenceSnapshot() {
  if (typeof window === "undefined") return `dark:${DEFAULT_ACCENT}`;
  const theme = localStorage.getItem(THEME_KEY);
  const accent = localStorage.getItem(ACCENT_KEY);
  return `${isThemeMode(theme) ? theme : "dark"}:${normalizeAccent(accent)}`;
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
          className="fixed left-4 right-4 top-[4.5rem] z-[100] rounded-2xl border border-neutral-800 bg-[#111111] p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(22rem,calc(100vw-2rem))]"
        >
          <div className="mb-4">
            <div className="text-sm font-semibold text-white">Appearance</div>
            <div className="text-xs text-neutral-500 mt-0.5">Theme and accent color</div>
          </div>

          <div className="relative mb-4 grid grid-cols-2 gap-1 overflow-hidden rounded-full border border-neutral-800 bg-[#0a0a0a] p-1">
            <div
              className={cn(
                "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-emerald-500 transition-transform duration-300 ease-out",
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
                    "relative z-10 h-10 rounded-full text-sm font-semibold transition-colors duration-200 inline-flex items-center justify-center gap-2",
                    theme === option.value ? "text-black" : "text-neutral-500 hover:text-white"
                  )}
                >
                  <Icon size={15} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-3">
            <div className="mb-3 rounded-xl border border-neutral-800 bg-[#111111] px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">RGB color</div>
              <div className="text-xs text-neutral-500 mt-0.5">Drag the picker or edit the values directly.</div>
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
                updateFromColorField(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1) updateFromColorField(event);
              }}
              className="relative h-48 cursor-crosshair overflow-hidden rounded-xl border border-neutral-800 shadow-inner"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
              }}
            >
              <span
                className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: accent }}
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Pipette size={18} className="shrink-0 text-neutral-500" />
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
                  updateFromHueTrack(event);
                }}
                onPointerMove={(event) => {
                  if (event.buttons === 1) updateFromHueTrack(event);
                }}
                className="relative h-7 flex-1 cursor-pointer rounded-full border border-neutral-800"
                style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
              >
                <span
                  className="absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
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
                  className="h-10 rounded-xl border border-neutral-800 bg-[#111111] px-3 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                  aria-label="Hex color"
                />
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["r", "R", rgb.r],
                    ["g", "G", rgb.g],
                    ["b", "B", rgb.b],
                  ] as const).map(([channel, label, value]) => (
                    <label key={channel} className="flex h-10 items-center gap-1 rounded-xl border border-neutral-800 bg-[#111111] px-2 text-sm text-neutral-500">
                      <span className="font-bold">{label}</span>
                      <input
                        value={value}
                        type="number"
                        min={0}
                        max={255}
                        inputMode="numeric"
                        onChange={(event) => updateRgbChannel(channel, event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-right text-white focus:outline-none"
                        aria-label={`${label} channel`}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl border border-neutral-800 shadow-sm" style={{ backgroundColor: accent }} />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {presetAccents.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => {
                  setHexDraft(null);
                  applyPreferences(theme, option.value);
                }}
                className={cn(
                  "h-8 flex-1 rounded-full border transition-transform hover:scale-105",
                  accent === option.value ? "border-white shadow-[0_0_0_3px_var(--accent-soft)]" : "border-white/20"
                )}
                style={{ backgroundColor: option.value }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
