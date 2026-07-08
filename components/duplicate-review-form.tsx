"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Copy, LoaderCircle, Search, TicketPlus } from "lucide-react";
import { markDuplicateAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/errors";
import type { TicketRecord } from "@/lib/schema";

const initialState: ActionState = {};

type DuplicateReviewFormProps = {
  requestId: string;
  tickets: TicketRecord[];
  isPreview: boolean;
  approveFormId: string;
  workspaceSlug?: string;
};

export function DuplicateReviewForm({ requestId, tickets, isPreview, approveFormId, workspaceSlug }: DuplicateReviewFormProps) {
  const [dupState, markDuplicate] = useActionState(markDuplicateAction, initialState);
  const [query, setQuery] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(tickets[0]?.id ?? "");
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTickets = useMemo(() => {
    if (!normalizedQuery) return tickets.slice(0, 8);
    return tickets
      .filter((ticket) => `${ticket.id} ${ticket.title} ${ticket.location} ${ticket.department}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [normalizedQuery, tickets]);

  return (
    <section className="mt-6 border-t border-border pt-6">
      <div className="mb-4">
        <h3 className="font-medium text-fg">Possible duplicate</h3>
        <p className="text-sm text-muted mt-1">Link this request to an existing ticket instead of creating a new one.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <div className="space-y-3">
          <label htmlFor="duplicate-search" className="sr-only">Search existing tickets</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              id="duplicate-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tickets by ID, title, location, or department"
              disabled={isPreview || tickets.length === 0}
              className="input pl-9 disabled:cursor-not-allowed"
            />
          </div>

          <div className="max-h-72 overflow-auto rounded-[var(--radius-control)] border border-border bg-bg divide-y divide-border">
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-sm text-muted">No matching tickets.</div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  disabled={isPreview}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`w-full p-4 text-left hover:bg-surface-hover transition-colors disabled:cursor-not-allowed ${selectedTicketId === ticket.id ? "bg-accent-soft" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-fg truncate">{ticket.title}</span>
                    <span className="font-mono text-[10px] font-medium text-muted shrink-0">{ticket.id}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted truncate">{ticket.location} · {ticket.status} · {ticket.department}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[var(--radius-control)] border border-border bg-bg p-4">
          <div className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] mb-3">Selected ticket</div>
          {selectedTicket ? (
            <div className="space-y-2">
              <div className="font-mono text-[10px] font-medium text-accent">{selectedTicket.id}</div>
              <div className="text-sm font-medium text-fg leading-snug">{selectedTicket.title}</div>
              <div className="text-xs text-muted">{selectedTicket.location}</div>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="font-mono text-[10px] px-2 py-1 rounded-md bg-surface-hover text-muted uppercase">{selectedTicket.status}</span>
                <span className="font-mono text-[10px] px-2 py-1 rounded-md bg-surface-hover text-muted uppercase">{selectedTicket.priority}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Select a ticket to link.</p>
          )}
        </div>
      </div>

      {dupState.error ? (
        <div role="alert" className="mt-4 st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Couldn&apos;t save.</span> {dupState.error}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <form action={markDuplicate} className="sm:flex-1">
          {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="duplicateOfTicketId" value={selectedTicketId} />
          <SubmitButton
            pendingText="Marking duplicate..."
            disabled={isPreview || !selectedTicketId}
            className="btn--neutral btn--block"
          >
            <Copy size={16} /> Mark as duplicate
          </SubmitButton>
        </form>
        <button
          type="submit"
          form={approveFormId}
          disabled={isPreview || createPending}
          onClick={() => setCreatePending(true)}
          className="btn btn--primary sm:flex-1"
        >
          {createPending ? (
            <>
              <LoaderCircle size={18} className="animate-spin" /> Creating ticket...
            </>
          ) : (
            <>
              <TicketPlus size={18} /> Create new ticket
            </>
          )}
        </button>
      </div>
    </section>
  );
}
