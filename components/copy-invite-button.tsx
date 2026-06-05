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
    <button type="button" onClick={copy} className="h-9 px-3 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-700 inline-flex items-center gap-2">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
