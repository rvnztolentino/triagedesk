import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Clock, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTickets } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TICKETS_PER_PAGE = 10;

function normalizeSearch(value: string | undefined) {
  return (value ?? "").trim();
}

function pageNumber(value: string | undefined) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function TicketList({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = params.filter || "all";
  const query = normalizeSearch(params.q);
  const requestedPage = pageNumber(params.page);
  const isAdmin = user.role === "admin";
  const tickets = await listTickets(filter, isAdmin ? undefined : user.id);
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

  const ticketsHref = (next: { filter?: string; q?: string; page?: number }) => {
    const nextParams = new URLSearchParams();
    nextParams.set("filter", next.filter ?? filter);
    const nextQuery = next.q ?? query;
    if (nextQuery) nextParams.set("q", nextQuery);
    nextParams.set("page", String(next.page ?? currentPage));
    return `/tickets?${nextParams.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">{isAdmin ? "All Tickets" : "My Tickets"}</h1>
          <p className="text-neutral-500 mt-1">{isAdmin ? "Manage and track all operations requests." : "Track requests submitted from your account."}</p>
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl shadow-xl border border-neutral-800 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 gap-4 flex-wrap bg-[#151515]">
          <div className="flex items-center gap-2 bg-[#0a0a0a] p-1 rounded-xl border border-neutral-800">
            {[
              ["all", "All"],
              ["active", "Active"],
              ["resolved", "Resolved"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={ticketsHref({ filter: value, page: 1 })}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                  filter === value ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          <form action="/tickets" className="flex min-w-full flex-1 items-center gap-2 sm:min-w-[320px]">
            <input type="hidden" name="filter" value={filter} />
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search tickets"
                className="h-10 w-full rounded-xl border border-neutral-800 bg-[#0a0a0a] pl-9 pr-3 text-sm text-white placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button className="h-10 rounded-xl border border-neutral-800 bg-neutral-800 px-4 text-sm font-bold text-white hover:bg-neutral-700">
              Search
            </button>
            {query ? (
              <Link href={ticketsHref({ q: "", page: 1 })} className="h-10 rounded-xl border border-neutral-800 px-4 text-sm font-bold text-neutral-400 hover:bg-neutral-800 hover:text-white inline-flex items-center">
                Clear
              </Link>
            ) : null}
          </form>
        </div>

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
                      <Link href={`/tickets/${ticket.id}`} className="block">
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
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        ) : (
                          <div className={cn("w-2 h-2 rounded-full", ticket.priority === "critical" || ticket.priority === "high" ? "bg-red-500 animate-pulse" : "bg-blue-500")} />
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
                      <Link href={`/tickets/${ticket.id}`} className="inline-flex p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
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
              href={currentPage <= 1 ? ticketsHref({ page: 1 }) : ticketsHref({ page: currentPage - 1 })}
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
              href={currentPage >= totalPages ? ticketsHref({ page: totalPages }) : ticketsHref({ page: currentPage + 1 })}
              className={cn(
                "h-9 px-3 rounded-lg border border-neutral-800 text-xs font-bold inline-flex items-center gap-2 transition-colors",
                currentPage >= totalPages ? "pointer-events-none text-neutral-700" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              )}
            >
              Next <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
