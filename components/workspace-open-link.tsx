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
        "p-5 flex flex-col gap-3 transition-colors border-l-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        pending ? "pointer-events-none border-emerald-500 bg-emerald-500/10" : isActive ? "border-emerald-500 bg-emerald-500/5" : "border-transparent hover:bg-[#151515]"
      )}
    >
      <div className="min-w-0">
        <h3 className="font-semibold text-white truncate">{name}</h3>
        <p className="text-xs text-neutral-500 font-mono mt-1 truncate">{slug}</p>
      </div>
      <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
        {pending ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <LoaderCircle size={13} className="animate-spin" /> Opening
          </span>
        ) : isActive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <CheckCircle2 size={13} /> Open
          </span>
        ) : null}
        <span className={isPreview ? "text-[10px] font-bold uppercase tracking-wider text-amber-400" : "text-[10px] font-bold uppercase tracking-wider text-neutral-500"}>
          {isPreview ? "Preview locked" : role}
        </span>
        {pending ? null : <ArrowRight size={16} className="text-neutral-500" />}
      </div>
    </Link>
  );
}
