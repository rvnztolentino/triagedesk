import { AlertTriangle, ArrowRight, LockKeyhole, MapPin, User } from "lucide-react";
import Link from "next/link";
import { submitRequestAction } from "@/app/actions";
import { RequestAttachmentsInput } from "@/components/request-attachments-input";
import { SubmitButton } from "@/components/submit-button";
import { requireWorkspaceContext } from "@/lib/auth";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";

export async function SubmitRequestView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { workspace } = await requireWorkspaceContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const isPreview = isWorkspacePreview(workspace.id);
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
            <span className="font-mono text-fg">.codex/setup.md</span>, then restart the dev server.
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
    <div className="max-w-2xl mx-auto w-full">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-fg mb-2">New Request</h1>
        <p className="text-muted">Describe the issue and AI triage will structure it immediately.</p>
      </div>

      <div className="bg-surface rounded-[var(--radius-card)] p-8 md:p-10 border border-border">
        <form action={submitRequestAction} className="space-y-6">
          {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
          {isPreview ? (
            <div className="st-warn rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
              <LockKeyhole size={15} className="mt-0.5 shrink-0" />
              <p><span className="font-semibold">Preview locked.</span> This sample form is visible for evaluation. Create your own workspace to submit a request.</p>
            </div>
          ) : null}
          <fieldset disabled={isPreview} className="space-y-6 disabled:opacity-60">
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-fg">What&apos;s the issue?</label>
            <textarea
              id="description"
              name="description"
              required
              minLength={10}
              rows={5}
              placeholder="E.g., Aircon in Room 304 is leaking again. Floor is wet near the outlet."
              className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-4 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors resize-none placeholder:text-faint"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="location" className="text-sm font-medium text-fg flex items-center gap-2">
                <MapPin size={16} className="text-muted" /> Location
              </label>
              <input
                id="location"
                name="location"
                required
                type="text"
                placeholder="Building A, Room 304"
                className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors placeholder:text-faint"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="contactName" className="text-sm font-medium text-fg flex items-center gap-2">
                <User size={16} className="text-muted" /> Contact Name
              </label>
              <input
                id="contactName"
                name="contactName"
                type="text"
                placeholder="Jane Doe"
                className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors placeholder:text-faint"
              />
            </div>
          </div>

          <div className="space-y-2 relative">
            <label htmlFor="urgencyNote" className="text-sm font-medium text-fg flex items-center gap-2">
              <AlertTriangle size={16} className="text-muted" /> Urgency Note (Optional)
            </label>
            <input
              id="urgencyNote"
              name="urgencyNote"
              type="text"
              placeholder="Why is it urgent?"
              className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors pr-10 placeholder:text-faint"
            />
          </div>

          <RequestAttachmentsInput />

          <div className="pt-6 border-t border-border flex items-center justify-between">
            <Link href={href("/tickets")} className="text-sm font-medium text-muted hover:text-fg px-4 py-2 transition-colors">
              Cancel
            </Link>
            <SubmitButton pendingText="Uploading..." className="w-auto h-auto px-8 py-3">
              {isPreview ? <><LockKeyhole size={16} /> Preview locked</> : <>Submit Request <ArrowRight size={16} /></>}
            </SubmitButton>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}

export default async function SubmitRequest() {
  return <SubmitRequestView />;
}
