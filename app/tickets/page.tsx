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
            <tr className="bg-[#0d0d0d] border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
              <th className="font-semibold p-6 w-28">ID</th>
              <th className="font-semibold p-6">Details</th>
              <th className="font-semibold p-6">Status</th>
              <th className="font-semibold p-6">Department</th>
              <th className="font-semibold p-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {visibleTickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  <h3 className="font-semibold text-white">{isSetupRequired ? "Setup required" : query ? "No matching tickets" : "No tickets found"}</h3>
                  <p className="text-sm text-neutral-500 mt-1">
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
                <tr key={ticket.id} className="hover:bg-[#151515] transition-colors group">
                  <td className="p-6">
                    <span className="text-sm font-mono font-medium text-neutral-500">{ticket.id}</span>
                  </td>
                  <td className="p-6">
                    <Link href={scopedWorkspaceHref(workspaceSlug, `/tickets/${ticket.id}`)} className="block">
                      <div className="font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">{ticket.title}</div>
                      <div className="text-sm text-neutral-500 flex items-center gap-3">
                        <span>{ticket.location}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                        <span className="flex items-center gap-1">
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
                      <span className="text-sm font-medium capitalize text-neutral-300">{ticket.status.replace("-", " ")}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="bg-neutral-800 text-neutral-400 text-xs px-2 py-1 rounded-md font-medium tracking-wide uppercase">
                      {ticket.department}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <Link href={scopedWorkspaceHref(workspaceSlug, `/tickets/${ticket.id}`)} className="inline-flex p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-full transition-colors">
                      <ArrowUpRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-6 border-t border-neutral-800 flex flex-col gap-4 text-sm text-neutral-500 md:flex-row md:items-center md:justify-between">
        <span>
          Showing {visibleTickets.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + visibleTickets.length, filteredTickets.length)} of {filteredTickets.length} tickets
        </span>
        <div className="flex items-center gap-3">
          <Link
            aria-disabled={currentPage <= 1}
            href={currentPage <= 1 ? ticketsHref(workspaceSlug, current, { page: 1 }) : ticketsHref(workspaceSlug, current, { page: currentPage - 1 })}
            className={cn(
              "h-9 px-3 rounded-lg border border-neutral-800 text-xs font-bold inline-flex items-center gap-2 transition-colors",
              currentPage <= 1 ? "pointer-events-none text-neutral-700" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
            )}
          >
            <ArrowLeft size={14} /> Previous
          </Link>
          <span className="text-xs text-neutral-500">
            Page {currentPage} of {totalPages}
          </span>
          <Link
            aria-disabled={currentPage >= totalPages}
            href={currentPage >= totalPages ? ticketsHref(workspaceSlug, current, { page: totalPages }) : ticketsHref(workspaceSlug, current, { page: currentPage + 1 })}
            className={cn(
              "h-9 px-3 rounded-lg border border-neutral-800 text-xs font-bold inline-flex items-center gap-2 transition-colors",
              currentPage >= totalPages ? "pointer-events-none text-neutral-700" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
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
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">{isAdmin ? "All Tickets" : "My Tickets"}</h1>
          <p className="text-neutral-500 mt-1">{isAdmin ? "Manage and track all operations requests." : "Track requests submitted from your account."}</p>
        </div>
      </div>

      <TicketsTableShell key={`${filter}:${query}:${requestedPage}`} filter={filter} query={query} requestedPage={requestedPage} workspaceSlug={workspaceSlug}>
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
