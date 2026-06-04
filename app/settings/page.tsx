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
          <h1 className="text-3xl font-bold tracking-tight text-white font-space">Settings</h1>
          <p className="text-neutral-500 mt-1">
            {isAdmin ? "Review workspace configuration and access policy." : "Manage your personal appearance preferences."}
          </p>
        </div>
      </div>

      {isAdmin && setup ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings size={17} className="text-emerald-400" />
              <h2 className="font-semibold text-white">System Health</h2>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">Database</span>
                <span className="text-neutral-200">{setup.supabaseConfigured ? "Configured" : "Missing setup"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">AI triage</span>
                <span className="text-neutral-200">{setup.groqConfigured ? "Configured" : "Missing setup"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Attachment bucket</span>
                <span className="text-neutral-200">{setup.storageBucket}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 size={17} className="text-emerald-400" />
              <h2 className="font-semibold text-white">Access Policy</h2>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">Workspace entry</span>
                <span className="text-neutral-200">Invite only</span>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">Assigned role</span>
                <span className="text-neutral-200">From invite</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Invite creation</span>
                <span className="text-neutral-200">{isPreview ? "Locked in preview" : membership.role === "owner" ? "Requester or admin" : "Requester only"}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{params.error}</div>
      ) : null}

      {isAdmin ? (
        <div className="bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-neutral-800 bg-[#151515]">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Building2 size={17} className="text-emerald-400" /> Departments
            </h2>
            <p className="text-sm text-neutral-500 mt-1">Request creation and AI triage use this workspace list.</p>
          </div>

          <div className="divide-y divide-neutral-800">
            {departments.map((department) => (
              <div key={department.id} className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-white">{department.name}</div>
                  <div className="text-xs text-neutral-500 mt-1">{department.id}{department.description ? ` · ${department.description}` : ""}</div>
                </div>
                {!isPreview && !(defaultDepartmentIds as readonly string[]).includes(department.id) ? (
                  <form action={deleteWorkspaceDepartmentAction}>
                    {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
                    <input type="hidden" name="id" value={department.id} />
                    <button className="h-9 px-3 rounded-lg border border-rose-500/30 text-xs font-bold text-rose-300 hover:bg-rose-500/10 inline-flex items-center gap-2">
                      <Trash2 size={14} /> Remove
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>

          {!isPreview ? (
            <form action={createWorkspaceDepartmentAction} className="p-6 border-t border-neutral-800 grid grid-cols-1 gap-3 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
              <div className="space-y-2">
                <label htmlFor="department-id" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">ID</label>
                <input id="department-id" name="id" required placeholder="transport" className="h-11 w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-neutral-700" />
              </div>
              <div className="space-y-2">
                <label htmlFor="department-name" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Name</label>
                <input id="department-name" name="name" required placeholder="Transport" className="h-11 w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-neutral-700" />
              </div>
              <div className="space-y-2">
                <label htmlFor="department-description" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Description</label>
                <input id="department-description" name="description" placeholder="Vehicle and shuttle requests" className="h-11 w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-neutral-700" />
              </div>
              <button className="h-11 px-5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm font-bold text-white hover:bg-neutral-700">
                Add
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {missing.length > 0 ? (
        <div className="bg-[#111111] border border-amber-500/30 rounded-2xl p-6">
          <h2 className="font-semibold text-amber-300">Missing configuration</h2>
          <p className="text-sm text-neutral-500 mt-1">{missing.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <SettingsPageView searchParams={searchParams} />;
}
