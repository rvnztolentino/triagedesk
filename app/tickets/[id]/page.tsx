import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, Clock, FileText, MapPin, MessageSquare, User } from "lucide-react";
import { updateTicketAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getTicketDetail, listDepartments } from "@/lib/store";
import { ticketStatuses } from "@/lib/schema";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin" || user.role === "owner";
  const { id } = await params;
  const detail = await getTicketDetail(id, isAdmin ? undefined : user.id);
  const departments = await listDepartments();

  if (!detail) {
    notFound();
  }

  const { ticket, activity, notes, similarTickets } = detail;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between mb-6">
        <Link href="/tickets" className="text-sm font-medium text-neutral-500 hover:text-white flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Tickets
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="bg-[#111111] rounded-2xl p-8 shadow-xl border border-neutral-800">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-mono font-bold text-neutral-500">{ticket.id}</span>
              <span className={cn("text-[10px] px-2 py-1 uppercase tracking-wider font-bold rounded-md", ticket.status === "resolved" || ticket.status === "closed" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400")}>
                {ticket.status}
              </span>
              <span className="text-[10px] px-2 py-1 uppercase tracking-wider font-bold rounded-md bg-neutral-800 text-neutral-400">
                {ticket.priority} Priority
              </span>
            </div>

            <h1 className="text-2xl font-bold font-space text-white mb-6">{ticket.title}</h1>

            <div className="text-sm text-neutral-300 mb-8 p-4 bg-[#0a0a0a] border border-neutral-800 rounded-xl">
              {ticket.description}
            </div>

            <div className="mb-8 p-5 bg-neutral-900 text-white rounded-2xl relative overflow-hidden flex flex-col gap-3 border border-neutral-800">
              <div className="absolute -top-10 -right-10 opacity-5 rotate-12">
                <AlertTriangle size={150} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 relative z-10 flex items-center gap-2">
                <FileText size={14} /> AI Triage Summary
              </h3>
              <p className="text-sm font-medium leading-relaxed relative z-10">{ticket.triageSummary}</p>
              <p className="text-xs text-neutral-500 relative z-10">{ticket.priorityReasoning}</p>
            </div>

            {isAdmin ? (
            <form action={updateTicketAction} className="mt-8 pt-8 border-t border-neutral-800 space-y-5">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-white">
                <MessageSquare size={18} className="text-neutral-400" /> Update Ticket
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="status" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</label>
                  <select id="status" name="status" defaultValue={ticket.status} className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500">
                    {ticketStatuses.map((status) => (
                      <option key={status} value={status}>{status.replace("-", " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="department" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Department</label>
                  <select id="department" name="department" defaultValue={ticket.department} className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500">
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="resolutionNotes" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Resolution Notes</label>
                <textarea id="resolutionNotes" name="resolutionNotes" defaultValue={ticket.resolutionNotes} rows={3} className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
              </div>

              <div className="space-y-2">
                <label htmlFor="note" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Internal Note</label>
                <textarea id="note" name="note" rows={2} placeholder="Add a note or update..." className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none placeholder:text-neutral-700" />
              </div>

              <div className="flex justify-end">
                <button className="bg-emerald-500 text-black px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-600">Save Update</button>
              </div>
            </form>
            ) : null}
          </div>

          {isAdmin ? (
          <div className="bg-[#111111] rounded-2xl p-6 shadow-xl border border-neutral-800">
            <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
              <MessageSquare size={18} className="text-neutral-400" /> Internal Notes
            </h3>
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-neutral-500">No internal notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-neutral-400">{note.actor}</span>
                      <span className="text-[10px] text-neutral-600">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-neutral-300 leading-relaxed">{note.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          ) : null}
        </div>

        <div className="col-span-1 space-y-6">
          {isAdmin ? (
          <div className="bg-[#111111] rounded-2xl p-6 shadow-xl border border-neutral-800">
            <h3 className="font-semibold text-white mb-6">Details</h3>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-neutral-500 mt-0.5" />
                <div>
                  <div className="text-xs text-neutral-500 font-medium">Location</div>
                  <div className="text-neutral-200 mt-0.5">{ticket.location}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User size={16} className="text-neutral-500 mt-0.5" />
                <div>
                  <div className="text-xs text-neutral-500 font-medium">Contact</div>
                  <div className="text-neutral-200 mt-0.5">{ticket.contactName || "Anonymous"}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 size={16} className="text-neutral-500 mt-0.5" />
                <div>
                  <div className="text-xs text-neutral-500 font-medium">Department</div>
                  <div className="text-neutral-200 mt-0.5 uppercase tracking-wider">{ticket.department}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-neutral-500 mt-0.5" />
                <div>
                  <div className="text-xs text-neutral-500 font-medium">Created</div>
                  <div className="text-neutral-200 mt-0.5">{new Date(ticket.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
          ) : null}

          <div className="bg-[#111111] rounded-2xl p-6 shadow-xl border border-neutral-800">
            <h3 className="font-semibold text-white mb-6">Similar Tickets</h3>
            <div className="space-y-3">
              {similarTickets.length === 0 ? (
                <p className="text-sm text-neutral-500">No close matches found.</p>
              ) : (
                similarTickets.map((similar) => (
                  <Link key={similar.id} href={`/tickets/${similar.id}`} className="block bg-[#0a0a0a] border border-neutral-800 p-3 rounded-xl hover:border-neutral-700">
                    <div className="text-sm font-semibold text-white">{similar.title}</div>
                    <div className="text-xs text-neutral-500 mt-1">{similar.id} &middot; {similar.reason}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#111111] rounded-2xl p-6 shadow-xl border border-neutral-800">
            <h3 className="font-semibold text-white mb-6">Activity History</h3>

            <div className="relative border-l-2 border-neutral-800 ml-3 space-y-6 pb-2">
              {activity.map((act, i) => (
                <div key={act.id} className="pl-6 relative">
                  <div className={cn("absolute w-3 h-3 rounded-full -left-[7.5px] top-1", i === 0 ? "bg-emerald-500 ring-4 ring-[#111111]" : "bg-neutral-700 ring-4 ring-[#111111]")} />
                  <div className="text-sm font-medium text-white">{act.action}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {act.actor} &middot; {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">{act.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
