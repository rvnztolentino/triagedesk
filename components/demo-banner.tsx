"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Timer } from "lucide-react";
import { DEMO_PRIVACY_NOTE, DEMO_SIGNUP_HREF, formatDemoRemaining } from "@/lib/demo-ui";

// One tick a minute. The label is only ever accurate to the minute, so a faster
// interval would re-render the app shell repeatedly to paint the same string.
const TICK_MS = 60 * 1000;

/**
 * Persistent demo notice for the app shell. `initialLabel` is computed on the
 * server and used as the first render so the countdown never causes a hydration
 * mismatch (server and client clocks differ by definition); the interval takes
 * over once mounted.
 */
export function DemoBanner({ expiresAt, initialLabel }: { expiresAt?: string; initialLabel?: string }) {
  const [remaining, setRemaining] = React.useState(initialLabel);

  React.useEffect(() => {
    if (!expiresAt) return;

    const update = () => setRemaining(formatDemoRemaining(expiresAt));
    update();
    const timer = window.setInterval(update, TICK_MS);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return (
    <div
      className="mb-6 rounded-[var(--radius-card)] border border-accent-border bg-accent-soft p-4"
      role="status"
      aria-live="off"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 text-sm">
          <Timer size={15} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="text-fg">
              <span className="font-semibold">Demo workspace</span>
              {remaining ? <> &mdash; resets in {remaining}. Sign up to keep it.</> : <> &mdash; sign up to keep it.</>}
            </p>
            <p className="mt-1 text-xs text-muted">{DEMO_PRIVACY_NOTE}</p>
          </div>
        </div>
        <Link href={DEMO_SIGNUP_HREF} className="btn btn--primary btn--sm shrink-0">
          Create free account <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
