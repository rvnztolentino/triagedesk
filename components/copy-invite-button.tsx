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
    <button type="button" onClick={copy} className="btn btn--sm">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
