"use client";

import { useMemo, useState } from "react";
import { Copy, LoaderCircle, Search, TicketPlus } from "lucide-react";
import { markDuplicateAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { TicketRecord } from "@/lib/schema";

type DuplicateReviewFormProps = {
  requestId: string;
  tickets: TicketRecord[];
  isPreview: boolean;
  approveFormId: string;
  workspaceSlug?: string;
};

export function DuplicateReviewForm({ requestId, tickets, isPreview, approveFormId, workspaceSlug }: DuplicateReviewFormProps) {
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
    <section className="mt-6 border-t border-neutral-800 pt-6">
      <div className="mb-4">
        <h3 className="font-semibold text-white">Possible duplicate</h3>
        <p className="text-sm text-neutral-500 mt-1">Link this request to an existing ticket instead of creating a new one.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <div className="space-y-3">
          <label htmlFor="duplicate-search" className="sr-only">Search existing tickets</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              id="duplicate-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tickets by ID, title, location, or department"
              disabled={isPreview || tickets.length === 0}
              className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl py-3 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-neutral-700 disabled:cursor-not-allowed"
            />
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-neutral-800 bg-[#0a0a0a] divide-y divide-neutral-800">
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No matching tickets.</div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  disabled={isPreview}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`w-full p-4 text-left hover:bg-[#151515] disabled:cursor-not-allowed ${selectedTicketId === ticket.id ? "bg-emerald-500/10" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white truncate">{ticket.title}</span>
                    <span className="text-[10px] font-bold text-neutral-500 shrink-0">{ticket.id}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 truncate">{ticket.location} · {ticket.status} · {ticket.department}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-4">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Selected ticket</div>
          {selectedTicket ? (
            <div className="space-y-2">
              <div className="text-[10px] font-mono font-bold text-emerald-400">{selectedTicket.id}</div>
              <div className="text-sm font-semibold text-white leading-snug">{selectedTicket.title}</div>
              <div className="text-xs text-neutral-500">{selectedTicket.location}</div>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="text-[10px] px-2 py-1 rounded-md bg-neutral-900 text-neutral-400 uppercase">{selectedTicket.status}</span>
                <span className="text-[10px] px-2 py-1 rounded-md bg-neutral-900 text-neutral-400 uppercase">{selectedTicket.priority}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Select a ticket to link.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <form action={markDuplicateAction} className="sm:flex-1">
          {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="duplicateOfTicketId" value={selectedTicketId} />
          <SubmitButton
            pendingText="Marking duplicate..."
            disabled={isPreview || !selectedTicketId}
            className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-xl px-5 py-3 text-sm font-bold hover:bg-neutral-700 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:text-neutral-600 disabled:hover:bg-neutral-800"
          >
            <Copy size={18} /> Mark as duplicate
          </SubmitButton>
        </form>
        <button
          type="submit"
          form={approveFormId}
          disabled={isPreview || createPending}
          onClick={() => setCreatePending(true)}
          className="sm:flex-1 bg-emerald-500 text-black rounded-xl px-5 py-3 text-sm font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
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
