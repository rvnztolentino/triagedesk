"use client";

import { useActionState } from "react";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { startDemoAction } from "@/app/actions";
import type { ActionState } from "@/lib/errors";
import { cn } from "@/lib/utils";

const initialState: ActionState = {};

type TryDemoButtonProps = {
  /** Layout classes for the wrapper, e.g. "w-full sm:w-auto". */
  className?: string;
  /** Variant classes appended to `btn`, e.g. "btn--ghost btn--sm". */
  buttonClassName?: string;
  label?: string;
  /**
   * Standing caption under the button. Where it is set, a failure replaces it in the
   * same slot so nothing on the page moves. Where it is not (the fixed header, which
   * cannot grow) the message floats below the button instead.
   */
  note?: string;
};

/**
 * The demo entry point. A form post rather than a link, so the request is
 * same-origin checked and rate-limited before anything is written; a `GET` link
 * would be followed by every crawler and prefetcher that touches the landing page.
 */
export function TryDemoButton({ className, buttonClassName, label = "Live demo", note }: TryDemoButtonProps) {
  const [state, startDemo, pending] = useActionState(startDemoAction, initialState);

  return (
    <div className={cn("relative", className)}>
      <form action={startDemo}>
        <button type="submit" disabled={pending} className={cn("btn", buttonClassName)}>
          {pending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Building your workspace...
            </>
          ) : (
            <>
              {label}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {note ? (
        <p
          role={state.error ? "alert" : undefined}
          className="mt-2 text-xs leading-snug"
          style={{ color: state.error ? "var(--danger)" : "var(--muted)" }}
        >
          {state.error ?? note}
        </p>
      ) : state.error ? (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2.5 text-left text-xs leading-snug"
          style={{ boxShadow: "var(--shadow-lg)", color: "var(--danger)" }}
        >
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
          {state.error}
        </div>
      ) : null}
    </div>
  );
}
