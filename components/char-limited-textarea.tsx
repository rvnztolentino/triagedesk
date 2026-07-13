"use client";

import { useState, type ComponentPropsWithoutRef, type CSSProperties } from "react";

// Live character counter shared by capped inputs. Turns to the danger color as
// the value approaches the limit so the writer knows the hard cap is close.
export function CharCounter({
  length,
  max,
  style,
}: {
  length: number;
  max: number;
  style?: CSSProperties;
}) {
  const near = length >= max * 0.9;
  return (
    <div
      className="field-hint"
      aria-live="polite"
      style={{ textAlign: "right", marginTop: 4, color: near ? "var(--danger)" : undefined, ...style }}
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </div>
  );
}

type CharLimitedTextareaProps = Omit<ComponentPropsWithoutRef<"textarea">, "maxLength"> & {
  max: number;
  showCounter?: boolean;
};

// Uncontrolled textarea with a hard `maxLength` cap (mirrors the server-side zod
// limit) plus a live counter. Keeps its own length state so callers don't have
// to lift it; still forwards `onChange` for anyone who needs the value.
export function CharLimitedTextarea({
  max,
  showCounter = true,
  defaultValue,
  onChange,
  ...props
}: CharLimitedTextareaProps) {
  const [length, setLength] = useState(typeof defaultValue === "string" ? defaultValue.length : 0);

  return (
    <>
      <textarea
        {...props}
        defaultValue={defaultValue}
        maxLength={max}
        onChange={(event) => {
          setLength(event.target.value.length);
          onChange?.(event);
        }}
      />
      {showCounter ? <CharCounter length={length} max={max} /> : null}
    </>
  );
}
