import { describe, expect, it } from "vitest";
import { addMonths, assertCleanDisplayName, MAX_NAME_CHANGES, nameChangeStatus, NAME_CHANGE_WINDOW_MONTHS } from "./display-name";

describe("display name filter", () => {
  it("accepts a normal name and rejects profanity, links, and controls", () => {
    expect(assertCleanDisplayName("  Vic  Marlowe ")).toBe("Vic Marlowe");
    expect(() => assertCleanDisplayName("sh1t head")).toThrow();
    expect(() => assertCleanDisplayName("visit www.spam.example")).toThrow();
    expect(() => assertCleanDisplayName("a")).toThrow();
  });
});

describe("name change window", () => {
  const start = new Date("2026-01-01T00:00:00.000Z");

  it("reports a full allowance when no window has started", () => {
    const status = nameChangeStatus(0, undefined, start);
    expect(status.used).toBe(0);
    expect(status.remaining).toBe(MAX_NAME_CHANGES);
    expect(status.resetAt).toBeNull();
  });

  it("counts changes inside an active window and exposes the reset date", () => {
    const status = nameChangeStatus(1, start.toISOString(), addMonths(start, 1));
    expect(status.used).toBe(1);
    expect(status.remaining).toBe(1);
    expect(status.resetAt?.getTime()).toBe(addMonths(start, NAME_CHANGE_WINDOW_MONTHS).getTime());
  });

  it("blocks further changes once the allowance is spent in-window", () => {
    const status = nameChangeStatus(MAX_NAME_CHANGES, start.toISOString(), addMonths(start, 1));
    expect(status.remaining).toBe(0);
  });

  it("resets to a full allowance once the window has elapsed", () => {
    const status = nameChangeStatus(MAX_NAME_CHANGES, start.toISOString(), addMonths(start, NAME_CHANGE_WINDOW_MONTHS));
    expect(status.used).toBe(0);
    expect(status.remaining).toBe(MAX_NAME_CHANGES);
    expect(status.resetAt).toBeNull();
  });
});
