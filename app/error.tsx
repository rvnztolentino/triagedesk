"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Segment-level error boundary: catches uncaught errors thrown while rendering
// any page/server component (and any server action not handled inline), reports
// them to Sentry, and offers a retry instead of Next.js's fatal screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface border border-border rounded-[var(--radius-card)] p-8 text-center">
        <div className="st-danger w-12 h-12 border rounded-[var(--radius-control)] flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-fg mb-2">Something went wrong</h1>
        <p className="text-sm text-muted mb-6">
          An unexpected error interrupted this page. You can try again. If it keeps
          happening, it has already been reported.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-faint mb-6">Ref: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-accent text-accent-fg rounded-[var(--radius-control)] px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <RotateCcw size={16} /> Try again
        </button>
      </div>
    </div>
  );
}
