"use client";

import React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { DEMO_SIGNUP_HREF, DEMO_UPGRADE_BODY, DEMO_UPGRADE_TITLE } from "@/lib/demo-ui";
import { cn } from "@/lib/utils";

/**
 * Explains an account-only action to a live-demo visitor instead of letting them
 * click into a redirect or a server-side error. Pages that can explain inline do
 * that instead; this exists for the app chrome, where there is no room to.
 *
 * The server-side deny-list in `lib/auth.ts` is what actually blocks these actions.
 * This is affordance only, and is deliberately not the security boundary.
 */
export function DemoLockButton({
  children,
  className,
  body = DEMO_UPGRADE_BODY,
}: {
  children: React.ReactNode;
  className?: string;
  body?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Return focus to the control that opened the dialog, so keyboard users are not
  // dropped back at the top of the document.
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button ref={triggerRef} type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-lock-title"
            tabIndex={-1}
            className={cn(
              "w-full max-w-[26rem] rounded-[var(--radius-card)] border border-border bg-surface p-6 outline-none",
              "text-left shadow-xl"
            )}
          >
            <div className="st-warn mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border">
              <Lock size={17} />
            </div>
            <h2 id="demo-lock-title" className="text-base font-semibold tracking-tight text-fg">
              {DEMO_UPGRADE_TITLE}
            </h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={DEMO_SIGNUP_HREF} className="btn btn--primary btn--sm">
                Create free account
              </Link>
              <button type="button" className="btn btn--sm" onClick={close}>
                Keep exploring
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
