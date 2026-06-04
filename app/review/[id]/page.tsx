import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, Check, FileText, LockKeyhole, Paperclip, Sparkles, X } from "lucide-react";
import { approveRequestAction, rejectRequestAction } from "@/app/actions";
import { AttachmentFileName } from "@/components/attachment-file-name";
import { DuplicateReviewForm } from "@/components/duplicate-review-form";
import { requireWorkspaceAdminContext } from "@/lib/auth";
import { getRequestBundle, listDepartments, listTickets } from "@/lib/store";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function ReviewDetailView({ params, workspaceSlug }: { params: Promise<{ id: string }>; workspaceSlug?: string }) {
  const { workspace } = await requireWorkspaceAdminContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const { id } = await params;
  const bundle = await getRequestBundle(id, undefined, workspace.id);
  const departments = await listDepartments(workspace.id);
  const tickets = await listTickets("all", undefined, workspace.id);
  const isPreview = isWorkspacePreview(workspace.id);

  if (!bundle) {
    notFound();
  }

  const { request, triage, similarTickets, attachments } = bundle;
  const approveFormId = `approve-${request.id}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <Link href={href("/review")} className="text-sm font-medium text-neutral-500 hover:text-white flex items-center gap-2 mb-6 w-fit">
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

              {attachments.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Paperclip size={12} /> Attachments
                  </div>
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <a key={attachment.id} href={href(`/attachments/${attachment.id}`)} className="flex min-w-0 items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
                        <FileText size={14} className="shrink-0" /> <AttachmentFileName fileName={attachment.fileName} className="flex-1" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {request.status === "duplicate" && request.duplicateOfTicketId ? (
                <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-3 text-sm font-semibold text-neutral-300">
                  Duplicate · Linked to {request.duplicateOfTicketId}
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
                  <Link key={ticket.id} href={href(`/tickets/${ticket.id}`)} className="block bg-[#0a0a0a] border border-neutral-800 p-3 rounded-xl hover:border-neutral-700">
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

          <form id={approveFormId} action={approveRequestAction} className="space-y-6 relative">
            {isPreview ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex items-start gap-2">
                <LockKeyhole size={15} className="mt-0.5 shrink-0 text-amber-400" />
                <p><span className="font-bold text-amber-300">Preview locked.</span> Review fields are visible for evaluation, but approval actions are disabled.</p>
              </div>
            ) : null}
            <fieldset disabled={isPreview} className="space-y-6 disabled:opacity-60">
            {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
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
                {isPreview ? <><LockKeyhole size={18} /> Preview locked</> : <><Check size={18} /> Approve & Dispatch</>}
              </button>
            </div>
            </fieldset>
          </form>

          <DuplicateReviewForm requestId={request.id} tickets={tickets} isPreview={isPreview} approveFormId={approveFormId} workspaceSlug={workspaceSlug} />

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <form action={rejectRequestAction}>
              {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
              <input type="hidden" name="requestId" value={request.id} />
              <button disabled={isPreview} className="bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl px-6 py-3 text-sm font-bold hover:bg-rose-500/20 transition-all flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
                <X size={18} /> Reject
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  return <ReviewDetailView params={params} />;
}
