import { Building2, CheckCircle2, Settings, Trash2 } from "lucide-react";
import { createWorkspaceDepartmentAction, deleteWorkspaceDepartmentAction } from "@/app/actions";
import { requireWorkspaceContext } from "@/lib/auth";
import { listDepartments } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { defaultDepartmentIds } from "@/lib/schema";
import { isWorkspacePreview } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

function setupLabel(value: string) {
  const labels: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "database URL",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "browser auth key",
    SUPABASE_SERVICE_ROLE_KEY: "server database key",
    SEED_ADMIN_EMAIL: "seed owner email",
    GROQ_API_KEY: "AI service key",
    "AI_PROVIDER=groq": "AI triage provider",
  };
  return labels[value] ?? value;
}

export async function SettingsPageView({ searchParams, workspaceSlug }: { searchParams: Promise<{ error?: string }>; workspaceSlug?: string }) {
  const { membership, workspace } = await requireWorkspaceContext(workspaceSlug);
  const isPreview = isWorkspacePreview(workspace.id);
  const isAdmin = isPreview || membership.role === "admin" || membership.role === "owner";
  const setup = isAdmin ? getRuntimeSetupStatus() : null;
  const missing = setup ? setup.missing.map(setupLabel) : [];
  const departments = isAdmin ? await listDepartments(workspace.id) : [];
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Settings</h1>
          <p className="text-muted mt-1">
            {isAdmin ? "Review workspace configuration and access policy." : "Manage your personal appearance preferences."}
          </p>
        </div>
      </div>

      {isAdmin && setup ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings size={17} className="text-accent" />
              <h2 className="font-medium text-fg">System Health</h2>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-muted">Database</span>
                <span className="text-fg">{setup.supabaseConfigured ? "Configured" : "Missing setup"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-muted">AI triage</span>
                <span className="text-fg">{setup.groqConfigured ? "Configured" : "Missing setup"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Attachment bucket</span>
                <span className="text-fg">{setup.storageBucket}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 size={17} className="text-accent" />
              <h2 className="font-medium text-fg">Access Policy</h2>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-muted">Workspace entry</span>
                <span className="text-fg">Invite only</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-muted">Assigned role</span>
                <span className="text-fg">From invite</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Invite creation</span>
                <span className="text-fg">{isPreview ? "Locked in preview" : membership.role === "owner" ? "Requester or admin" : "Requester only"}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {params.error ? (
        <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm">{params.error}</div>
      ) : null}

      {isAdmin ? (
        <div className="bg-surface border border-border rounded-[var(--radius-card)] overflow-hidden">
          <div className="p-6 border-b border-border bg-surface-2">
            <h2 className="font-medium text-fg flex items-center gap-2">
              <Building2 size={17} className="text-accent" /> Departments
            </h2>
            <p className="text-sm text-muted mt-1">Request creation and AI triage use this workspace list.</p>
          </div>

          <div className="divide-y divide-border">
            {departments.map((department) => (
              <div key={department.id} className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-fg">{department.name}</div>
                  <div className="font-mono text-xs text-muted mt-1">{department.id}{department.description ? ` · ${department.description}` : ""}</div>
                </div>
                {!isPreview && !(defaultDepartmentIds as readonly string[]).includes(department.id) ? (
                  <form action={deleteWorkspaceDepartmentAction}>
                    {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
                    <input type="hidden" name="id" value={department.id} />
                    <button className="st-danger h-9 px-3 rounded-[var(--radius-control)] border text-xs font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                      <Trash2 size={14} /> Remove
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>

          {!isPreview ? (
            <form action={createWorkspaceDepartmentAction} className="p-6 border-t border-border grid grid-cols-1 gap-3 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
              <div className="space-y-2">
                <label htmlFor="department-id" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">ID</label>
                <input id="department-id" name="id" required placeholder="transport" className="h-11 w-full bg-bg border border-border rounded-[var(--radius-control)] px-3 text-sm text-fg focus:outline-none focus:border-accent-border placeholder:text-faint" />
              </div>
              <div className="space-y-2">
                <label htmlFor="department-name" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Name</label>
                <input id="department-name" name="name" required placeholder="Transport" className="h-11 w-full bg-bg border border-border rounded-[var(--radius-control)] px-3 text-sm text-fg focus:outline-none focus:border-accent-border placeholder:text-faint" />
              </div>
              <div className="space-y-2">
                <label htmlFor="department-description" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Description</label>
                <input id="department-description" name="description" placeholder="Vehicle and shuttle requests" className="h-11 w-full bg-bg border border-border rounded-[var(--radius-control)] px-3 text-sm text-fg focus:outline-none focus:border-accent-border placeholder:text-faint" />
              </div>
              <button className="h-11 px-5 bg-surface-hover border border-border rounded-[var(--radius-control)] text-sm font-medium text-fg hover:bg-surface transition-colors">
                Add
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div className="bg-surface border border-[var(--st-warn)]/40 rounded-[var(--radius-card)] p-6">
          <h2 className="font-medium text-[var(--st-warn)]">Missing configuration</h2>
          <p className="text-sm text-muted mt-1">{missing.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <SettingsPageView searchParams={searchParams} />;
}
