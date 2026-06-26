"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyInviteButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${value}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copy} className="h-9 px-3 rounded-[var(--radius-control)] bg-surface border border-border text-xs font-medium text-muted hover:text-fg hover:bg-surface-hover transition-colors inline-flex items-center gap-2">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
