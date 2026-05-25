import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, Check, Copy, Sparkles, X } from "lucide-react";
import { approveRequestAction, markDuplicateAction, rejectRequestAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getRequestBundle, listDepartments, listTickets } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const bundle = await getRequestBundle(id);
  const departments = await listDepartments();
  const tickets = await listTickets("all");

  if (!bundle) {
    notFound();
  }

  const { request, triage, similarTickets } = bundle;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <Link href="/review" className="text-sm font-medium text-neutral-500 hover:text-white flex items-center gap-2 mb-6 w-fit">
        <ArrowLeft size={16} /> Back to Queue
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-[#111111] rounded-2xl p-6 shadow-xl border border-neutral-800">
            <h2 className="font-semibold text-white mb-6">Raw Submission</h2>

            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Original Description</div>
                <div className="text-sm text-neutral-300 bg-[#0a0a0a] border border-neutral-800 p-3 rounded-xl">{request.description}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Location</div>
                <div className="text-sm text-neutral-300">{request.location}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Contact</div>
                <div className="text-sm text-neutral-300">{request.contactName || "Anonymous"}</div>
              </div>

              {request.urgencyNote ? (
                <div>
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> User Urgency
                  </div>
                  <div className="text-sm font-medium text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{request.urgencyNote}</div>
                </div>
              ) : null}

              {request.imageUrl ? (
                <div>
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Photo</div>
                  <a href={request.imageUrl} className="block text-sm text-emerald-400 hover:text-emerald-300">
                    View uploaded image
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-[#111111] rounded-2xl p-6 shadow-xl border border-neutral-800">
            <h2 className="font-semibold text-white mb-4">Similar Tickets</h2>
            <div className="space-y-3">
              {similarTickets.length === 0 ? (
                <p className="text-sm text-neutral-500">No close matches found.</p>
              ) : (
                similarTickets.map((ticket) => (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block bg-[#0a0a0a] border border-neutral-800 p-3 rounded-xl hover:border-neutral-700">
                    <div className="text-sm font-semibold text-white">{ticket.title}</div>
                    <div className="text-xs text-neutral-500 mt-1">{ticket.id} &middot; {ticket.reason}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 bg-[#111111] rounded-2xl p-8 shadow-xl border border-neutral-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-neutral-800">
            <Sparkles size={120} className="opacity-20 rotate-12" />
          </div>

          <div className="flex items-center gap-2 mb-8 relative">
            <Sparkles size={20} className="text-emerald-500" />
            <h2 className="text-xl font-bold font-space text-white">AI Triage Output</h2>
          </div>

          <form action={approveRequestAction} className="space-y-6 relative">
            <input type="hidden" name="requestId" value={request.id} />

            <div className="space-y-2">
              <label htmlFor="title" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Suggested Title</label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={triage.title}
                className="w-full text-lg font-semibold text-white bg-transparent border-b-2 border-dashed border-neutral-700 focus:border-emerald-500 focus:outline-none pb-2 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="priority" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={12} /> Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue={triage.priority}
                  className="w-full appearance-none bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer uppercase tracking-wider text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="department" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <Building2 size={12} /> Department
                </label>
                <select
                  id="department"
                  name="department"
                  defaultValue={triage.department}
                  className="w-full appearance-none bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer uppercase tracking-wider text-white"
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">AI Reasoning</label>
              <div className="text-sm text-neutral-400 italic bg-[#0a0a0a] p-4 rounded-xl border border-neutral-800">
                &quot;{triage.priorityReasoning}&quot;
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="summary" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Edited Summary</label>
              <textarea
                id="summary"
                name="summary"
                defaultValue={triage.summary}
                rows={4}
                className="w-full text-sm text-white bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none shadow-sm placeholder-neutral-600"
              />
            </div>

            <div className="pt-6 border-t border-neutral-800 flex flex-wrap items-center gap-4">
              <button className="bg-emerald-500 text-black rounded-xl px-8 py-3 text-sm font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 flex-1 justify-center">
                <Check size={18} /> Approve & Dispatch
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <form action={markDuplicateAction} className="flex flex-1 min-w-[260px] gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <select name="duplicateOfTicketId" className="min-w-0 flex-1 appearance-none bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500">
                {tickets.map((ticket) => (
                  <option key={ticket.id} value={ticket.id}>{ticket.id} - {ticket.title}</option>
                ))}
              </select>
              <button className="bg-neutral-800 text-white border border-neutral-700 rounded-xl px-5 py-3 text-sm font-bold hover:bg-neutral-700 transition-all flex items-center gap-2">
                <Copy size={18} /> Duplicate
              </button>
            </form>
            <form action={rejectRequestAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <button className="bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl px-6 py-3 text-sm font-bold hover:bg-rose-500/20 transition-all flex items-center gap-2">
                <X size={18} /> Reject
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
