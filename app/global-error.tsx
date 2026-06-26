"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Root error boundary: replaces the root layout when it (or something it renders)
// throws, so it must provide its own <html>/<body>. Uses inline styles so it
// renders correctly even if the app stylesheet failed to load. Reports to Sentry.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.11)",
            borderRadius: 12,
            padding: "2rem",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#a1a1a1", margin: "0 0 1.5rem" }}>
            A critical error interrupted the app. It has been reported. Please reload to continue.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#6b6b6b", margin: "0 0 1.5rem" }}>
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              background: "#879D5A",
              color: "#0a0a0a",
              border: "none",
              borderRadius: 8,
              padding: "0.75rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
