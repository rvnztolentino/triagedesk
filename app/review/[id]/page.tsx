import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, FileText, Paperclip, Sparkles } from "lucide-react";
import { AttachmentFileName } from "@/components/attachment-file-name";
import { ReviewDecisionForm } from "@/components/review-decision-form";
import { requireWorkspaceAdminContext } from "@/lib/auth";
import { getRequestBundle, listDepartments } from "@/lib/store";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function ReviewDetailView({ params, workspaceSlug }: { params: Promise<{ id: string }>; workspaceSlug?: string }) {
  const { workspace } = await requireWorkspaceAdminContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const { id } = await params;
  const bundle = await getRequestBundle(id, undefined, workspace.id);
  const departments = await listDepartments(workspace.id);
  const isPreview = isWorkspacePreview(workspace.id);

  if (!bundle) {
    notFound();
  }

  const { request, triage, similarTickets, attachments } = bundle;
  const approveFormId = `approve-${request.id}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <Link href={href("/review")} className="text-sm font-medium text-muted hover:text-fg flex items-center gap-2 mb-6 w-fit transition-colors">
        <ArrowLeft size={16} /> Back to Queue
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-surface rounded-[var(--radius-card)] p-6 border border-border">
            <h2 className="font-medium text-fg mb-6">Raw Submission</h2>

            <div className="space-y-4">
              <div>
                <div className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] mb-1">Original Description</div>
                <div className="text-sm text-fg bg-bg border border-border p-3 rounded-[var(--radius-control)]">{request.description}</div>
              </div>

              <div>
                <div className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] mb-1">Location</div>
                <div className="text-sm text-fg">{request.location}</div>
              </div>

              <div>
                <div className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] mb-1">Contact</div>
                <div className="text-sm text-fg">{request.contactName || "Anonymous"}</div>
              </div>

              {request.urgencyNote ? (
                <div>
                  <div className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] mb-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> User Urgency
                  </div>
                  <div className="st-danger text-sm font-medium p-3 rounded-[var(--radius-control)] border">{request.urgencyNote}</div>
                </div>
              ) : null}

              {request.imageUrl ? (
                <div>
                  <div className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] mb-1">Photo</div>
                  <a href={request.imageUrl} className="block text-sm text-accent hover:opacity-90">
                    View uploaded image
                  </a>
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div>
                  <div className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-1">
                    <Paperclip size={12} /> Attachments
                  </div>
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <a key={attachment.id} href={href(`/attachments/${attachment.id}`)} className="flex min-w-0 items-center gap-2 text-sm text-accent hover:opacity-90">
                        <FileText size={14} className="shrink-0" /> <AttachmentFileName fileName={attachment.fileName} className="flex-1" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {request.status === "duplicate" && request.duplicateOfTicketId ? (
                <div className="rounded-[var(--radius-control)] border border-border bg-bg p-3 text-sm font-medium text-fg">
                  Duplicate · Linked to {request.duplicateOfTicketId}
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-surface rounded-[var(--radius-card)] p-6 border border-border">
            <h2 className="font-medium text-fg mb-4">Similar Tickets</h2>
            <div className="space-y-3">
              {similarTickets.length === 0 ? (
                <p className="text-sm text-muted">No close matches found.</p>
              ) : (
                similarTickets.map((ticket) => (
                  <Link key={ticket.id} href={href(`/tickets/${ticket.id}`)} className="block bg-bg border border-border p-3 rounded-[var(--radius-control)] hover:border-border-strong transition-colors">
                    <div className="text-sm font-medium text-fg">{ticket.title}</div>
                    <div className="text-xs text-muted mt-1">{ticket.id} &middot; {ticket.reason}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 bg-surface rounded-[var(--radius-card)] p-8 border border-border">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles size={20} className="text-accent" />
            <h2 className="text-xl font-semibold text-fg">AI Triage Output</h2>
          </div>

          <ReviewDecisionForm formId={approveFormId} isPreview={isPreview}>
            {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
            <input type="hidden" name="requestId" value={request.id} />

            <div className="space-y-2">
              <label htmlFor="title" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Suggested Title</label>
              <input
                id="title"
                name="title"
                type="text"
                defaultValue={triage.title}
                className="w-full text-lg font-medium text-fg bg-transparent border-b border-dashed border-border-strong focus:border-accent focus:outline-none pb-2 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="priority" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] flex items-center gap-1">
                  <AlertTriangle size={12} /> Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue={triage.priority}
                  className="w-full appearance-none bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm font-medium focus:outline-none focus:border-accent-border cursor-pointer uppercase tracking-wider text-fg"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="department" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em] flex items-center gap-1">
                  <Building2 size={12} /> Department
                </label>
                <select
                  id="department"
                  name="department"
                  defaultValue={triage.department}
                  className="w-full appearance-none bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm font-medium focus:outline-none focus:border-accent-border cursor-pointer uppercase tracking-wider text-fg"
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">AI Reasoning</label>
              <div className="text-sm text-muted italic bg-bg p-4 rounded-[var(--radius-control)] border border-border">
                &quot;{triage.priorityReasoning}&quot;
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="summary" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Edited Summary</label>
              <textarea
                id="summary"
                name="summary"
                defaultValue={triage.summary}
                rows={4}
                className="w-full text-sm text-fg bg-bg border border-border rounded-[var(--radius-control)] p-4 focus:outline-none focus:border-accent-border resize-none placeholder:text-faint"
              />
            </div>
          </ReviewDecisionForm>
        </div>
      </div>
    </div>
  );
}

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  return <ReviewDetailView params={params} />;
}
