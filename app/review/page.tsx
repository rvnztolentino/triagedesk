import Link from "next/link";
import { AlertCircle, ChevronRight, Clock, Sparkles } from "lucide-react";
import { requireWorkspaceAdminContext } from "@/lib/auth";
import { listReviewItems } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export const dynamic = "force-dynamic";

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical":
      return "st-danger border";
    case "high":
      return "st-warn border";
    case "medium":
      return "bg-surface-hover text-muted";
    default:
      return "bg-surface-hover text-faint";
  }
}

export async function ReviewQueueView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { workspace } = await requireWorkspaceAdminContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const queue = await listReviewItems(workspace.id);
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Review Queue</h1>
          <p className="text-muted mt-1">AI-triaged requests waiting for human approval.</p>
        </div>
      </div>

      <div className="bg-surface rounded-[var(--radius-card)] border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface-2">
          <h2 className="font-medium text-fg flex items-center gap-2">
            <Sparkles size={16} className="text-accent" /> Auto-triage Pending ({queue.length})
          </h2>
        </div>

        {queue.length === 0 ? (
          <div className="divide-y divide-border">
            <div className="p-10 text-center">
              <h3 className="font-medium text-fg">{isSetupRequired ? "Setup required" : "No requests waiting"}</h3>
              <p className="text-sm text-muted mt-1">
                {isSetupRequired ? "Database and AI triage configuration must be completed." : "New submissions will appear here after AI triage."}
              </p>
              {isSetupRequired ? (
                <Link href="/api/health" className="mt-5 inline-flex bg-surface text-fg border border-border rounded-[var(--radius-control)] px-5 py-2 text-sm font-medium hover:bg-surface-hover transition-colors">
                  Check Health
                </Link>
              ) : (
                <Link href={href("/submit")} className="mt-5 inline-flex bg-accent text-accent-fg rounded-[var(--radius-control)] px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                  Submit Request
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px] divide-y divide-border">
              {queue.map(({ request, triage }) => (
                <Link key={request.id} href={href(`/review/${request.id}`)} className="block hover:bg-surface-hover transition-colors group">
                  <div className="p-6 flex items-center gap-6">
                    <div className="flex-shrink-0 flex flex-col items-center gap-2 w-16">
                      <div className={cn("w-10 h-10 rounded-[var(--radius-control)] flex items-center justify-center", getPriorityColor(triage.priority))}>
                        <AlertCircle size={18} />
                      </div>
                      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{triage.priority}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-medium text-fg truncate group-hover:text-accent transition-colors">{triage.title}</h3>
                        <span className="bg-surface-hover text-muted text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide uppercase">
                          {triage.department}
                        </span>
                        <span className="bg-accent-soft text-accent border border-accent-border text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide ml-auto uppercase">
                          {request.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted truncate mb-2">{request.description}</p>
                      <div className="flex items-center gap-4 text-xs font-medium text-muted">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={12} /> {new Date(request.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span>{request.location}</span>
                        <span>{request.contactName || "Anonymous"}</span>
                      </div>
                    </div>

                    <div className="hidden lg:block w-64 bg-bg rounded-[var(--radius-control)] p-3 border border-border">
                      <div className="font-mono text-[10px] font-medium text-accent uppercase tracking-[0.1em] mb-1 flex items-center gap-1">
                        <Sparkles size={10} /> AI Summary
                      </div>
                      <div className="text-xs text-muted line-clamp-2">{triage.summary}</div>
                    </div>

                    <div className="flex-shrink-0 ml-4 text-faint group-hover:text-fg transition-colors">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ReviewQueue() {
  return <ReviewQueueView />;
}
