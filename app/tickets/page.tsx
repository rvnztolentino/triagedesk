import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import { requireWorkspaceContext } from "@/lib/auth";
import { listTickets } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { ticketStatusIndicatorClass } from "@/lib/ticket-status";
import { cn } from "@/lib/utils";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";
import { ticketsHref } from "@/lib/ticket-links";
import { TicketsTableShell, TicketsTableSkeleton } from "./tickets-table-shell";

export const dynamic = "force-dynamic";

const TICKETS_PER_PAGE = 10;

interface TicketParams {
  filter?: string;
  q?: string;
  page?: string;
}

function normalizeSearch(value: string | undefined) {
  return (value ?? "").trim();
}

function pageNumber(value: string | undefined) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

async function TicketTable({
  filter,
  query,
  requestedPage,
  isAdmin,
  userId,
  workspaceId,
  workspaceSlug,
}: {
  filter: string;
  query: string;
  requestedPage: number;
  isAdmin: boolean;
  userId: string;
  workspaceId: string;
  workspaceSlug?: string;
}) {
  const tickets = await listTickets(filter, isAdmin ? undefined : userId, workspaceId);
  const normalizedQuery = query.toLowerCase();
  const filteredTickets = normalizedQuery
    ? tickets.filter((ticket) =>
        [
          ticket.id,
          ticket.title,
          ticket.description,
          ticket.location,
          ticket.status,
          ticket.department,
          ticket.priority,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : tickets;
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * TICKETS_PER_PAGE;
  const visibleTickets = filteredTickets.slice(pageStart, pageStart + TICKETS_PER_PAGE);
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;
  const current = { filter, q: query, page: currentPage };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-2 border-b border-border font-mono text-xs uppercase tracking-[0.12em] text-muted">
              <th className="font-medium p-6 w-28">ID</th>
              <th className="font-medium p-6">Details</th>
              <th className="font-medium p-6">Status</th>
              <th className="font-medium p-6">Department</th>
              <th className="font-medium p-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleTickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  <h3 className="font-medium text-fg">{isSetupRequired ? "Setup required" : query ? "No matching tickets" : "No tickets found"}</h3>
                  <p className="text-sm text-muted mt-1">
                    {isSetupRequired
                      ? "Database and AI triage configuration must be completed."
                      : query
                        ? "Try a different ID, title, location, status, or department."
                        : isAdmin
                          ? "Tickets will appear here after requests are approved."
                          : "Your approved requests will appear here as tickets."}
                  </p>
                </td>
              </tr>
            ) : (
              visibleTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-surface-hover transition-colors group">
                  <td className="p-6">
                    <span className="text-sm font-mono font-medium text-muted">{ticket.id}</span>
                  </td>
                  <td className="p-6">
                    <Link href={scopedWorkspaceHref(workspaceSlug, `/tickets/${ticket.id}`)} className="block">
                      <div className="font-medium text-fg mb-1 group-hover:text-accent transition-colors">{ticket.title}</div>
                      <div className="text-sm text-muted flex items-center gap-3">
                        <span>{ticket.location}</span>
                        <span className="w-1 h-1 rounded-full bg-border-strong" />
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={12} /> {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      {ticket.status === "resolved" || ticket.status === "closed" ? (
                        <CheckCircle2 size={16} className={ticketStatusIndicatorClass(ticket.status)} />
                      ) : (
                        <div className={cn("w-2 h-2 rounded-full", ticketStatusIndicatorClass(ticket.status))} />
                      )}
                      <span className="text-sm font-medium capitalize text-fg">{ticket.status.replace("-", " ")}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="bg-surface-hover text-muted text-xs px-2 py-1 rounded-md font-medium tracking-wide uppercase">
                      {ticket.department}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <Link href={scopedWorkspaceHref(workspaceSlug, `/tickets/${ticket.id}`)} className="inline-flex p-2 text-muted hover:text-fg hover:bg-surface-hover rounded-[var(--radius-control)] transition-colors">
                      <ArrowUpRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-6 border-t border-border flex flex-col gap-4 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <span className="font-mono text-xs">
          Showing {visibleTickets.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + visibleTickets.length, filteredTickets.length)} of {filteredTickets.length} tickets
        </span>
        <div className="flex items-center gap-3">
          <Link
            aria-disabled={currentPage <= 1}
            href={currentPage <= 1 ? ticketsHref(workspaceSlug, current, { page: 1 }) : ticketsHref(workspaceSlug, current, { page: currentPage - 1 })}
            className={cn(
              "h-9 px-3 rounded-[var(--radius-control)] border border-border text-xs font-medium inline-flex items-center gap-2 transition-colors",
              currentPage <= 1 ? "pointer-events-none text-faint" : "text-muted hover:bg-surface-hover hover:text-fg"
            )}
          >
            <ArrowLeft size={14} /> Previous
          </Link>
          <span className="font-mono text-xs text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <Link
            aria-disabled={currentPage >= totalPages}
            href={currentPage >= totalPages ? ticketsHref(workspaceSlug, current, { page: totalPages }) : ticketsHref(workspaceSlug, current, { page: currentPage + 1 })}
            className={cn(
              "h-9 px-3 rounded-[var(--radius-control)] border border-border text-xs font-medium inline-flex items-center gap-2 transition-colors",
              currentPage >= totalPages ? "pointer-events-none text-faint" : "text-muted hover:bg-surface-hover hover:text-fg"
            )}
          >
            Next <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  );
}

export async function TicketListView({ searchParams, workspaceSlug }: { searchParams: Promise<TicketParams>; workspaceSlug?: string }) {
  const { user, workspace, membership } = await requireWorkspaceContext(workspaceSlug);
  const params = await searchParams;
  const filter = params.filter || "all";
  const query = normalizeSearch(params.q);
  const requestedPage = pageNumber(params.page);
  const isAdmin = isWorkspacePreview(workspace.id) || membership.role === "admin" || membership.role === "owner";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{isAdmin ? "All Tickets" : "My Tickets"}</h1>
          <p className="text-muted mt-1">{isAdmin ? "Manage and track all operations requests." : "Track requests submitted from your account."}</p>
        </div>
      </div>

      <TicketsTableShell filter={filter} query={query} requestedPage={requestedPage} workspaceSlug={workspaceSlug}>
        <Suspense key={`${filter}:${query}:${requestedPage}`} fallback={<TicketsTableSkeleton />}>
          <TicketTable filter={filter} query={query} requestedPage={requestedPage} isAdmin={isAdmin} userId={user.id} workspaceId={workspace.id} workspaceSlug={workspaceSlug} />
        </Suspense>
      </TicketsTableShell>
    </div>
  );
}

export default async function TicketList({ searchParams }: { searchParams: Promise<TicketParams> }) {
  return <TicketListView searchParams={searchParams} />;
}
