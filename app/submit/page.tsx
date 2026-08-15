import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { SubmitRequestForm } from "@/components/submit-request-form";
import { isDemoUser, requireWorkspaceContext } from "@/lib/auth";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";

export async function SubmitRequestView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { user, workspace } = await requireWorkspaceContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const isPreview = isWorkspacePreview(workspace.id);
  // Storage is closed to demo sessions in both directions, so the picker stays hidden
  // rather than failing on submit. submitRequestAction is still the boundary.
  const allowAttachments = !isDemoUser(user);
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;

  if (isSetupRequired && !isPreview) {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-surface rounded-[var(--radius-card)] p-8 md:p-10 border border-[var(--st-warn)]/40">
          <div className="flex items-center gap-3 mb-5">
            <div className="st-warn w-10 h-10 border rounded-[var(--radius-control)] flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-fg">Setup Required</h1>
              <p className="text-sm text-muted">New requests require database and AI triage configuration.</p>
            </div>
          </div>
          <div className="bg-bg border border-border rounded-[var(--radius-control)] p-4 text-sm text-muted leading-relaxed">
            Complete the manual setup in{" "}
            <span className="font-mono text-fg">README.md</span>, then restart the dev server.
          </div>
          <div className="pt-6 flex items-center justify-between">
            <Link href={href("/tickets")} className="text-sm font-medium text-muted hover:text-fg px-4 py-2 transition-colors">
              My Tickets
            </Link>
            <Link href="/api/health" className="bg-surface text-fg rounded-[var(--radius-control)] px-6 py-3 text-sm font-medium hover:bg-surface-hover transition-colors border border-border">
              Check Health
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full py-4">
      <div className="page-head">
        <span className="eyebrow">New request</span>
        <h1 className="page-title" style={{ marginTop: 8 }}>Submit a request</h1>
        <p className="page-sub">Describe what&apos;s wrong in plain language. AI triage structures the rest.</p>
      </div>

      <div className="card card-pad" style={{ padding: 24 }}>
        <SubmitRequestForm
          workspaceSlug={workspaceSlug}
          isPreview={isPreview}
          allowAttachments={allowAttachments}
          ticketsHref={href("/tickets")}
        />
      </div>
    </div>
  );
}

export default async function SubmitRequest() {
  return <SubmitRequestView />;
}
