"use client";

import Link from "next/link";
import { type MouseEvent, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

export function WorkspaceOpenLink({
  href,
  name,
  slug,
  role,
  isActive,
  isPreview,
}: {
  href: string;
  name: string;
  slug: string;
  role: string;
  isActive: boolean;
  isPreview: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Link
      href={href}
      aria-busy={pending}
      onClick={(event) => {
        if (!isModifiedClick(event) && event.currentTarget.target !== "_blank") {
          setPending(true);
        }
      }}
      className={cn(
        "p-5 flex flex-col gap-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        pending ? "pointer-events-none bg-accent-soft" : isActive ? "bg-accent-soft" : "hover:bg-surface-hover"
      )}
    >
      <div className="min-w-0">
        <h3 className="font-medium text-fg truncate">{name}</h3>
        <p className="text-xs text-muted font-mono mt-1 truncate">{slug}</p>
      </div>
      <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
        {pending ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-accent">
            <LoaderCircle size={13} className="animate-spin" /> Opening
          </span>
        ) : isActive ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-accent">
            <CheckCircle2 size={13} /> Open
          </span>
        ) : null}
        <span className={isPreview ? "font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--st-warn)]" : "font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted"}>
          {isPreview ? "Preview locked" : role}
        </span>
        {pending ? null : <ArrowRight size={16} className="text-muted" />}
      </div>
    </Link>
  );
}
