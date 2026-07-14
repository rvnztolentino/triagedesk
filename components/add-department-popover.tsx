"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createWorkspaceDepartmentAction } from "@/app/actions";

export function AddDepartmentPopover({ workspaceSlug, disabled = false }: { workspaceSlug?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn--neutral btn--sm"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? "Department limit reached. Delete one to add another." : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={14} /> Add
      </button>

      {open && !disabled ? (
        <div className="popover">
          <div className="between" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ fontSize: 14 }}>
              Add department
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close add department"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>

          <form action={createWorkspaceDepartmentAction} className="stack" style={{ gap: 12 }}>
            {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
            <div className="field">
              <label htmlFor="department-name" className="label">
                Name
              </label>
              <input id="department-name" name="name" required minLength={2} maxLength={80} placeholder="Transport" className="input" />
            </div>
            <div className="field">
              <label htmlFor="department-id" className="label">
                ID
              </label>
              <input id="department-id" name="id" required minLength={2} maxLength={40} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Use lowercase letters, numbers, and single hyphens." placeholder="transport" className="input mono" />
            </div>
            <div className="field">
              <label htmlFor="department-description" className="label">
                Description
              </label>
              <input id="department-description" name="description" maxLength={200} placeholder="Vehicle and shuttle requests" className="input" />
            </div>
            <button className="btn btn--primary btn--sm btn--block">
              <Plus size={14} /> Add department
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
