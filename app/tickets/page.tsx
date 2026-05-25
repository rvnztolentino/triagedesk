import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTickets } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TicketList({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = params.filter || "all";
  const isAdmin = user.role === "admin";
  const tickets = await listTickets(filter, isAdmin ? undefined : user.id);
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;

  const filterHref = (nextFilter: string) => `/tickets?filter=${nextFilter}`;

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
                href={filterHref(value)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                  filter === value ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
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
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <h3 className="font-semibold text-white">{isSetupRequired ? "Setup required" : "No tickets found"}</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      {isSetupRequired ? "Database and AI triage configuration must be completed." : isAdmin ? "Tickets will appear here after requests are approved." : "Your approved requests will appear here as tickets."}
                    </p>
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
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

        <div className="p-6 border-t border-neutral-800 flex items-center justify-between text-sm text-neutral-500">
          <span>Showing {tickets.length} results</span>
          <span>Workspace data</span>
        </div>
      </div>
    </div>
  );
}
