"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

function useCopied() {
  const [copied, setCopied] = useState(false);

  async function write(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return { copied, write };
}

export function CopyInviteButton({ value }: { value: string }) {
  const { copied, write } = useCopied();

  return (
    <button type="button" onClick={() => write(`${window.location.origin}${value}`)} className="btn btn--sm">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function CopyInviteCode({ code }: { code: string }) {
  const { copied, write } = useCopied();

  return (
    <button
      type="button"
      onClick={() => write(code)}
      className="copy-inline"
      title={copied ? "Copied" : "Copy invite code"}
      aria-label={`Copy invite code ${code}`}
    >
      <span className="mono">{code}</span>
      {copied ? <Check size={12} className="copy-inline__icon" /> : <Copy size={12} className="copy-inline__icon" />}
    </button>
  );
}
