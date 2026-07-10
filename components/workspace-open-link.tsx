"use client";

import { ArrowRight, Check } from "lucide-react";
import { activateWorkspaceAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

function glyph(name: string) {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "WS";
}

export function WorkspaceOpenLink({
  name,
  slug,
  role,
  isActive,
  isPreview,
}: {
  name: string;
  slug: string;
  role: string;
  isActive: boolean;
  isPreview: boolean;
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
              {isPreview ? (
                <span className="badge" data-hue="warn">
                  Preview
                </span>
              ) : null}
              {isActive ? (
                <span className="badge" data-hue="accent">
                  Active
                </span>
              ) : null}
            </div>
            <div className="muted mono" style={{ fontSize: 12.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {slug} · {role}
            </div>
          </div>
        </div>

        {isActive ? (
          <span className="btn btn--sm" style={{ opacity: 0.6 }} aria-disabled>
            <Check size={14} /> Opened
          </span>
        ) : (
          <form action={activateWorkspaceAction}>
            <input type="hidden" name="workspaceSlug" value={slug} />
            <SubmitButton pendingText="Opening" className="btn--neutral btn--sm w-auto">
              Open <ArrowRight size={14} />
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
