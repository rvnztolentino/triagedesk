"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

// A wink at the way Anthropic's models keep narrating little physical beats:
// the assistant leans back, adjusts its glasses, taps a pen while it "thinks".
// Shown as a rotating status line on the dedicated triaging screen.
const BEATS = [
  "Leaning back in the chair, reading your request…",
  "Adjusting its glasses, parsing the details…",
  "Tapping a pen against the desk, weighing priority…",
  "Steepling its fingers, scanning for similar tickets…",
  "Tilting its head, drafting a clean summary…",
  "Cracking its knuckles, choosing the right department…",
  "Nodding slowly, double-checking the routing…",
];

// Full-panel triaging view. Rendered in place of the form while the request is
// being submitted and triaged. No blur, the form steps aside entirely.
export function AiTriageLoading() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % BEATS.length);
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14 text-center" aria-live="polite">
      <span className="metric-icon" style={{ width: 52, height: 52 }}>
        <Sparkles size={22} className="animate-pulse" />
      </span>
      <div>
        <div className="eyebrow shimmer" style={{ marginBottom: 8 }}>Triaging your request</div>
        <p key={index} className="reveal muted" style={{ fontSize: 14, maxWidth: "36ch" }}>
          {BEATS[index]}
        </p>
      </div>
    </div>
  );
}
