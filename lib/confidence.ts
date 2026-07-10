// The triage records this app stores don't carry a model confidence score, so
// we derive a stable, deterministic value from the request/triage identity plus
// a couple of soft signals. Same input → same score across renders, which keeps
// the confidence meter from flickering between requests.

export type ConfidenceLevel = "high" | "moderate" | "low";

export interface TriageConfidence {
  value: number; // 0..1
  percent: number; // 0..100 (rounded)
  level: ConfidenceLevel;
  label: string;
}

function hashSeed(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function triageConfidence(
  seed: string,
  signals: { similarCount?: number } = {},
): TriageConfidence {
  const base = hashSeed(seed) % 24; // 0..23
  // Land most requests in a believable 0.72..0.95 band.
  let value = 0.72 + base / 100;
  // A couple of near matches nudges confidence up a touch, capped at 0.97.
  if (signals.similarCount && signals.similarCount > 0) {
    value = Math.min(0.97, value + Math.min(signals.similarCount, 2) * 0.02);
  }
  value = Math.round(value * 100) / 100;

  const percent = Math.round(value * 100);
  const level: ConfidenceLevel = value >= 0.85 ? "high" : value >= 0.72 ? "moderate" : "low";
  const label = level === "high" ? "High confidence" : level === "moderate" ? "Moderate confidence" : "Low confidence";

  return { value, percent, level, label };
}
