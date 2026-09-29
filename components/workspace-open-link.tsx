"use client";

import { ArrowRight, Check } from "lucide-react";
import { OpenWorkspaceButton } from "@/components/open-workspace-button";

function glyph(name: string) {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "WS";
}

export function WorkspaceOpenLink({
  name,
  slug,
  role,
  isActive,
}: {
  name: string;
  slug: string;
  role: string;
  isActive: boolean;
}) {
  return (
    <div className="card card-pad card-hover">
      <div className="between wrap" style={{ gap: 12 }}>
        <div className="cluster" style={{ gap: 12, minWidth: 0 }}>
          <span className="ws-pill-glyph" style={{ width: 40, height: 40, fontSize: 15, borderRadius: 11 }}>
            {glyph(name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="cluster wrap" style={{ gap: 8 }}>
              <span style={{ fontWeight: 650 }}>{name}</span>
              {isActive ? (
                <span className="badge" data-hue="accent">
                  Active
                </span>
              ) : null}
            </div>
            {/* A demo slug is a 32-character hex id with nothing to break on, so it
                wraps to the next line rather than pushing the card off a phone. */}
            <div className="muted mono" style={{ fontSize: 12.5, marginTop: 2, overflowWrap: "anywhere" }}>
              {`${slug} · ${role}`}
            </div>
          </div>
        </div>

        {isActive ? (
          <span className="btn btn--sm" style={{ opacity: 0.6 }} aria-disabled>
            <Check size={14} /> Opened
          </span>
        ) : (
          <OpenWorkspaceButton slug={slug} pendingText="Opening" className="btn--neutral btn--sm w-auto">
            Open <ArrowRight size={14} />
          </OpenWorkspaceButton>
        )}
      </div>
    </div>
  );
}
