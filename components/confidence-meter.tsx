import { triageConfidence, type ConfidenceLevel } from "@/lib/confidence";

const LEVEL_COLOR: Record<ConfidenceLevel, string> = {
  // Track the semantic status colors so all levels share one color scheme.
  high: "var(--st-done)",
  moderate: "var(--st-warn)",
  low: "var(--st-danger)",
};

// A clean status-bar style indicator for the AI triage confidence. Purely
// presentational. The score is derived deterministically in lib/confidence.
export function ConfidenceMeter({
  seed,
  similarCount = 0,
  className = "",
}: {
  seed: string;
  similarCount?: number;
  className?: string;
}) {
  const { percent, level, label } = triageConfidence(seed, { similarCount });
  const color = LEVEL_COLOR[level];

  return (
    <div className={className}>
      <div className="between" style={{ marginBottom: 8 }}>
        <span className="label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: color, display: "inline-block" }} />
          Triage confidence
        </span>
        <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color }}>{percent}%</span>
      </div>
      <div className="bar-track" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="bar-fill" style={{ width: `${percent}%`, background: color }} />
      </div>
      <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>{label}</div>
    </div>
  );
}
