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
        <div className="bg-[#111111] rounded-2xl p-10 border border-neutral-800 text-center">
          <h1 className="text-2xl font-bold text-white">Request not found</h1>
          <Link href={href("/submit")} className="text-emerald-400 text-sm mt-4 inline-block">Submit a new request</Link>
        </div>
      </div>
    );
  }

  const { request, triage, attachments } = result;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-[#111111] rounded-2xl p-8 md:p-10 shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-300" />

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-space mb-1">Request Received</h1>
            <p className="text-sm text-neutral-400">Request #{request.id} has been triaged and queued for review</p>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6 relative">
          <div className="absolute -top-3 right-6 bg-emerald-500 text-black text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
            <Sparkles size={12} /> AI Analysis
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-1">Suggested Title</h3>
              <p className="text-lg font-medium text-white">{triage.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111111] border border-neutral-800 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> Priority
                </h3>
                <span className="inline-block px-3 py-1 bg-rose-500/20 text-rose-500 font-bold text-xs rounded-md uppercase tracking-wider">
                  {triage.priority}
                </span>
              </div>
              <div className="bg-[#111111] border border-neutral-800 rounded-xl p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Building2 size={12} /> Department
                </h3>
                <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-md uppercase tracking-wider">
                  {triage.department}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Summary & Reasoning
              </h3>
              <p className="text-sm text-neutral-300 leading-relaxed bg-[#111111] border border-neutral-800 p-4 rounded-xl shadow-sm">
                <span className="font-bold text-neutral-500 uppercase text-[10px] block mb-1">Summary</span>
                {triage.summary}
                <span className="font-bold text-neutral-500 uppercase text-[10px] block mt-4 mb-1">Reasoning</span>
                {triage.priorityReasoning}
              </p>
            </div>

            {attachments.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Paperclip size={12} /> Attachments
                </h3>
                <div className="rounded-xl border border-neutral-800 bg-[#111111] divide-y divide-neutral-800">
                  {attachments.map((attachment) => (
                    <a key={attachment.id} href={href(`/attachments/${attachment.id}`)} className="px-4 py-3 flex min-w-0 items-center gap-3 text-sm text-neutral-300 hover:text-white">
                      <FileText size={15} className="text-neutral-500 shrink-0" />
                      <AttachmentFileName fileName={attachment.fileName} className="flex-1" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {request.status === "duplicate" && request.duplicateOfTicketId ? (
              <div className="rounded-xl border border-neutral-800 bg-[#111111] p-4 text-sm font-semibold text-neutral-300">
                Duplicate · Linked to {request.duplicateOfTicketId}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800 flex items-center justify-between">
          <Link href={isAdmin ? href("/") : href("/tickets")} className="text-sm font-medium text-neutral-500 hover:text-white flex items-center gap-2 transition-colors">
            <Home size={16} /> {isAdmin ? "Dashboard" : "My Tickets"}
          </Link>
          <Link href={isAdmin ? href(`/review/${request.id}`) : href("/submit")} className="bg-neutral-800 text-white rounded-full px-6 py-3 text-sm font-bold hover:bg-neutral-700 transition-all flex items-center gap-2 border border-neutral-700">
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
