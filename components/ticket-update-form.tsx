"use client";

import { useActionState } from "react";
import { AlertTriangle, LockKeyhole, MessageSquare } from "lucide-react";
import { updateTicketAction } from "@/app/actions";
import { CharLimitedTextarea } from "@/components/char-limited-textarea";
import { ticketStatuses, type DepartmentRecord } from "@/lib/schema";
import type { ActionState } from "@/lib/errors";

const initialState: ActionState = {};

export function TicketUpdateForm({
  workspaceSlug,
  ticketId,
  isPreview,
  status,
  department,
  resolutionNotes,
  departments,
}: {
  workspaceSlug?: string;
  ticketId: string;
  isPreview: boolean;
  status: string;
  department: string;
  resolutionNotes: string;
  departments: DepartmentRecord[];
}) {
  const [state, formAction] = useActionState(updateTicketAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {isPreview ? (
        <div className="st-warn rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <LockKeyhole size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Preview locked.</span> Ticket update controls are visible for evaluation, but changes cannot be saved.</p>
        </div>
      ) : null}
      {state.error ? (
        <div role="alert" className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Couldn&apos;t save.</span> {state.error}</p>
        </div>
      ) : null}
      <fieldset disabled={isPreview} className="space-y-5 disabled:opacity-60">
        {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
        <input type="hidden" name="ticketId" value={ticketId} />
        <h3 className="section-title mb-2 flex items-center gap-2">
          <MessageSquare size={18} className="text-muted" /> Update ticket
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="status" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Status</label>
            <select id="status" name="status" defaultValue={status} className="select">
              {ticketStatuses.map((value) => (
                <option key={value} value={value}>{value.replace("-", " ")}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="department" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Department</label>
            <select id="department" name="department" defaultValue={department} className="select">
              {departments.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="resolutionNotes" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Resolution Notes</label>
          <CharLimitedTextarea id="resolutionNotes" name="resolutionNotes" defaultValue={resolutionNotes} max={4000} rows={3} className="textarea" />
        </div>

        <div className="space-y-2">
          <label htmlFor="note" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Internal Note</label>
          <CharLimitedTextarea id="note" name="note" max={2000} rows={2} placeholder="Add a note or update..." className="textarea" />
        </div>

        <div className="flex justify-end">
          <button className="btn btn--primary btn--sm">
            {isPreview ? <><LockKeyhole size={14} /> Preview locked</> : "Save update"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
