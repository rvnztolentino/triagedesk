import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, FileText, Home, Paperclip, Sparkles } from "lucide-react";
import { AttachmentFileName } from "@/components/attachment-file-name";
import { requireWorkspaceContext } from "@/lib/auth";
import { getLatestRequestBundle, getRequestBundle } from "@/lib/store";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export const dynamic = "force-dynamic";

export async function SubmitConfirmView({ searchParams, requestId, workspaceSlug }: { searchParams?: Promise<{ id?: string }>; requestId?: string; workspaceSlug?: string }) {
  const { user, workspace, membership } = await requireWorkspaceContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  const params = searchParams ? await searchParams : {};
  const targetRequestId = requestId ?? params.id;
  const result = targetRequestId
    ? await getRequestBundle(targetRequestId, isAdmin ? undefined : user.id, workspace.id)
    : await getLatestRequestBundle(isAdmin ? undefined : user.id, workspace.id);

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-surface rounded-[var(--radius-card)] p-10 border border-border text-center">
          <h1 className="text-xl font-semibold text-fg">Request not found</h1>
          <Link href={href("/submit")} className="text-accent text-sm mt-4 inline-block hover:opacity-90">Submit a new request</Link>
        </div>
      </div>
    );
  }

  const { request, triage, attachments } = result;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-surface rounded-[var(--radius-card)] p-8 md:p-10 border border-border">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-accent-soft text-accent rounded-[var(--radius-control)] flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg mb-1">Request Received</h1>
            <p className="text-sm text-muted">Request #{request.id} has been triaged and queued for review</p>
          </div>
        </div>

        <div className="bg-bg border border-border rounded-[var(--radius-card)] p-6">
          <div className="mb-4 inline-flex items-center gap-1 text-accent text-[10px] font-medium uppercase tracking-[0.12em]">
            <Sparkles size={12} /> AI Analysis
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-mono text-xs font-medium text-muted uppercase tracking-[0.12em] mb-1">Suggested Title</h3>
              <p className="text-lg font-medium text-fg">{triage.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-[var(--radius-control)] p-4">
                <h3 className="font-mono text-xs font-medium text-muted uppercase tracking-[0.12em] mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> Priority
                </h3>
                <span className="st-danger inline-block border px-3 py-1 font-medium text-xs rounded-md uppercase tracking-wider">
                  {triage.priority}
                </span>
              </div>
              <div className="bg-surface border border-border rounded-[var(--radius-control)] p-4">
                <h3 className="font-mono text-xs font-medium text-muted uppercase tracking-[0.12em] mb-2 flex items-center gap-1">
                  <Building2 size={12} /> Department
                </h3>
                <span className="inline-block px-3 py-1 bg-accent-soft text-accent border border-accent-border font-medium text-xs rounded-md uppercase tracking-wider">
                  {triage.department}
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-mono text-xs font-medium text-muted uppercase tracking-[0.12em] mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Summary &amp; Reasoning
              </h3>
              <p className="text-sm text-fg leading-relaxed bg-surface border border-border p-4 rounded-[var(--radius-control)]">
                <span className="font-mono font-medium text-muted uppercase text-[10px] block mb-1">Summary</span>
                {triage.summary}
                <span className="font-mono font-medium text-muted uppercase text-[10px] block mt-4 mb-1">Reasoning</span>
                {triage.priorityReasoning}
              </p>
            </div>

            {attachments.length > 0 ? (
              <div>
                <h3 className="font-mono text-xs font-medium text-muted uppercase tracking-[0.12em] mb-2 flex items-center gap-1">
                  <Paperclip size={12} /> Attachments
                </h3>
                <div className="rounded-[var(--radius-control)] border border-border bg-surface divide-y divide-border">
                  {attachments.map((attachment) => (
                    <a key={attachment.id} href={href(`/attachments/${attachment.id}`)} className="px-4 py-3 flex min-w-0 items-center gap-3 text-sm text-fg hover:text-accent transition-colors">
                      <FileText size={15} className="text-muted shrink-0" />
                      <AttachmentFileName fileName={attachment.fileName} className="flex-1" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {request.status === "duplicate" && request.duplicateOfTicketId ? (
              <div className="rounded-[var(--radius-control)] border border-border bg-surface p-4 text-sm font-medium text-fg">
                Duplicate · Linked to {request.duplicateOfTicketId}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
          <Link href={isAdmin ? href("/") : href("/tickets")} className="text-sm font-medium text-muted hover:text-fg flex items-center gap-2 transition-colors">
            <Home size={16} /> {isAdmin ? "Dashboard" : "My Tickets"}
          </Link>
          <Link href={isAdmin ? href(`/review/${request.id}`) : href("/submit")} className="bg-surface text-fg rounded-[var(--radius-control)] px-6 py-3 text-sm font-medium hover:bg-surface-hover transition-colors flex items-center gap-2 border border-border">
            {isAdmin ? "Review Request" : "Submit Another"} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function SubmitConfirm({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <SubmitConfirmView searchParams={searchParams} />;
}
