"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Moon, Paintbrush, RotateCcw, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_KEY = "triagedesk-theme";
const ACCENT_KEY = "triagedesk-accent";
const PREFERENCE_EVENT = "triagedesk-preferences";
const DEFAULT_ACCENT = "#879D5A";
// A neutral gray leads the row for a muted, colorless accent; it reads clearly
// in both dark and light mode. Default green follows, then the color presets.
const NEUTRAL_ACCENT = "#7F7F7F";
const ACCENT_PRESETS = [NEUTRAL_ACCENT, "#879D5A", "#35d0ab", "#5b9dff", "#f2685f", "#e8b23a", "#a78bfa"];

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
          className="popover"
        >
          <div className="between" style={{ marginBottom: 14 }}>
            <div className="eyebrow">Appearance</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close appearance"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>

          <div className="eyebrow">Theme</div>
          <div className="seg" data-on={theme} style={{ marginTop: 8, marginBottom: 18 }}>
            <div className="seg-thumb" />
            <button
              type="button"
              className={cn("seg-btn", theme === "dark" && "on")}
              onClick={() => applyPreferences("dark", accent)}
            >
              <Moon size={15} /> Dark
            </button>
            <button
              type="button"
              className={cn("seg-btn", theme === "light" && "on")}
              onClick={() => applyPreferences("light", accent)}
            >
              <Sun size={15} /> Light
            </button>
          </div>

          <div className="between" style={{ marginBottom: 8 }}>
            <div className="eyebrow">Accent color</div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ padding: "4px 8px", fontSize: 11.5 }}
              onClick={() => {
                setHexDraft(null);
                applyPreferences(theme, DEFAULT_ACCENT);
              }}
            >
              <RotateCcw size={13} /> Set to default
            </button>
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
            className="color-field"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
          >
            <span
              className="color-field-thumb"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: accent }}
            />
          </div>

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
            className="hue-slider"
          >
            <span
              className="hue-thumb"
              style={{ left: `${(hsv.h / 359) * 100}%`, background: hueColor }}
            />
          </div>

          <div className="cluster" style={{ marginTop: 14, gap: 12 }}>
            <div className="swatch" style={{ background: accent }} />
            <div className="grow">
              <label htmlFor="accent-hex" className="label" style={{ display: "block", marginBottom: 5 }}>Hex</label>
              <input
                id="accent-hex"
                value={hexInput}
                onChange={(event) => updateFromHexInput(event.target.value)}
                onBlur={() => setHexDraft(null)}
                spellCheck={false}
                maxLength={7}
                className="mini-input"
                style={{ textAlign: "left", paddingLeft: 11 }}
                aria-label="Hex color"
              />
            </div>
          </div>

          <div className="rgb-grid" style={{ marginTop: 12 }}>
            {([
              ["r", "R", rgb.r],
              ["g", "G", rgb.g],
              ["b", "B", rgb.b],
            ] as const).map(([channel, channelLabel, value]) => (
              <div key={channel}>
                <label className="label" style={{ display: "block", textAlign: "center", marginBottom: 5 }}>{channelLabel}</label>
                <input
                  value={value}
                  type="number"
                  min={0}
                  max={255}
                  inputMode="numeric"
                  onChange={(event) => updateRgbChannel(channel, event.target.value)}
                  className="mini-input"
                  aria-label={`${channelLabel} channel`}
                />
              </div>
            ))}
          </div>

          <div className="cluster wrap" style={{ marginTop: 16, gap: 7 }}>
            {ACCENT_PRESETS.map((preset) => {
              const isCurrent = accent.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setHexDraft(null);
                    applyPreferences(theme, preset);
                  }}
                  aria-label={`Use ${preset}`}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    background: preset,
                    border: isCurrent ? "2px solid var(--fg)" : "1px solid var(--border-strong)",
                    boxShadow: preset === DEFAULT_ACCENT ? "0 0 0 2px var(--accent-soft)" : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
