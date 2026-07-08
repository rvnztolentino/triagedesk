import { Building2, Link2, PlusCircle } from "lucide-react";
import { createWorkspaceAction, joinWorkspaceAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { WorkspaceOpenLink } from "@/components/workspace-open-link";
import { getActiveWorkspaceAccess, requireUser } from "@/lib/auth";
import { DEMO_WORKSPACE_INVITE_CODE, isWorkspacePreview, listUserWorkspaces } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const workspaces = await listUserWorkspaces(user.id);
  const activeWorkspace = await getActiveWorkspaceAccess(user.id);
  const activeWorkspaceIsPreview = activeWorkspace ? isWorkspacePreview(activeWorkspace.workspace.id) : false;
  const params = await searchParams;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">Workspace Dashboard</span>
        <h1 className="text-2xl font-semibold tracking-tight text-fg mt-2">Manage your TriageDesk workspaces</h1>
        <p className="text-muted mt-2">Open an existing workspace, create one for your organization, or join with an invite code or link.</p>
      </div>

      {params.error ? (
        <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm">{params.error}</div>
      ) : null}

      {activeWorkspace ? (
        <section className="rounded-[var(--radius-card)] border border-accent-border bg-accent-soft px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[var(--radius-control)] bg-accent-soft border border-accent-border text-accent flex items-center justify-center shrink-0">
              <Building2 size={19} />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">Currently open workspace</p>
              <h2 className="text-base font-medium text-fg truncate mt-1">{activeWorkspace.workspace.name}</h2>
              {activeWorkspaceIsPreview ? <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--st-warn)] mt-1">Read-only preview</p> : null}
            </div>
          </div>
          <p className="text-xs text-muted sm:text-right">Requests, tickets, and settings are scoped to this workspace.</p>
        </section>
      ) : null}

      {workspaces.length > 0 ? (
        <section className="bg-surface border border-border rounded-[var(--radius-card)] overflow-hidden">
          <div className="p-6 border-b border-border bg-surface-2">
            <h2 className="font-medium text-fg">Your workspaces ({workspaces.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {workspaces.map(({ workspace, membership }) => {
              const isActive = activeWorkspace?.workspace.id === workspace.id;
              const isPreview = isWorkspacePreview(workspace.id);
              return (
                <WorkspaceOpenLink
                  key={workspace.id}
                  href={`/w/${workspace.slug}`}
                  name={workspace.name}
                  slug={workspace.slug}
                  role={membership.role}
                  isActive={isActive}
                  isPreview={isPreview}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <div className="st-warn rounded-[var(--radius-control)] border px-4 py-3 text-sm">
          Create or join a workspace before using requests, tickets, review, and settings.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
          <div className="w-11 h-11 rounded-[var(--radius-control)] bg-accent-soft border border-accent-border text-accent flex items-center justify-center mb-5">
            <Building2 size={20} />
          </div>
          <h2 className="text-xl font-semibold text-fg">Create workspace</h2>
          <p className="text-sm text-muted mt-2 mb-6">Start a new organization workspace. You will become its owner.</p>
          <form action={createWorkspaceAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-fg">Workspace name</label>
              <input id="name" name="name" required minLength={2} maxLength={80} placeholder="Acme Clinic" className="input" />
            </div>
            <SubmitButton pendingText="Creating workspace...">
              <PlusCircle size={16} /> Create workspace
            </SubmitButton>
          </form>
        </section>

        <section className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
          <div className="w-11 h-11 rounded-[var(--radius-control)] bg-accent-soft border border-accent-border text-accent flex items-center justify-center mb-5">
            <Link2 size={20} />
          </div>
          <h2 className="text-xl font-semibold text-fg">Join with invite</h2>
          <p className="text-sm text-muted mt-2 mb-6">Enter a valid invite code or paste the full invite link from a workspace owner or admin.</p>
          <form action={joinWorkspaceAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-fg">Invite code or link</label>
              <input id="code" name="code" required minLength={6} maxLength={500} placeholder={DEMO_WORKSPACE_INVITE_CODE} className="input font-mono" />
            </div>
            <SubmitButton pendingText="Joining workspace...">
              <Link2 size={16} /> Join workspace
            </SubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}
