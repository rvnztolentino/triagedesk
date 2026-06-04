import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Link2, PlusCircle } from "lucide-react";
import { createWorkspaceAction, joinWorkspaceAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getActiveWorkspaceAccess, requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
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
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Workspace Dashboard</span>
        <h1 className="text-3xl font-bold tracking-tight text-white font-space mt-2">Manage your TriageDesk workspaces</h1>
        <p className="text-neutral-500 mt-2">Open an existing workspace, create one for your organization, or join with an invite code or link.</p>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{params.error}</div>
      ) : null}

      {activeWorkspace ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Building2 size={19} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Currently open workspace</p>
              <h2 className="text-base font-semibold text-white truncate mt-1">{activeWorkspace.workspace.name}</h2>
              {activeWorkspaceIsPreview ? <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mt-1">Read-only preview</p> : null}
            </div>
          </div>
          <p className="text-xs text-neutral-400 sm:text-right">Requests, tickets, and settings are scoped to this workspace.</p>
        </section>
      ) : null}

      {workspaces.length > 0 ? (
        <section className="bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-neutral-800 bg-[#151515]">
            <h2 className="font-semibold text-white">Your workspaces ({workspaces.length})</h2>
          </div>
          <div className="divide-y divide-neutral-800">
            {workspaces.map(({ workspace, membership }) => {
              const isActive = activeWorkspace?.workspace.id === workspace.id;
              const isPreview = isWorkspacePreview(workspace.id);
              return (
                <Link
                  key={workspace.id}
                  href={`/w/${workspace.slug}/activate`}
                  className={cn(
                    "p-5 flex items-center justify-between gap-4 transition-colors border-l-2",
                    isActive ? "border-emerald-500 bg-emerald-500/5" : "border-transparent hover:bg-[#151515]"
                  )}
                >
                  <div>
                    <h3 className="font-semibold text-white">{workspace.name}</h3>
                    <p className="text-xs text-neutral-500 font-mono mt-1">{workspace.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        <CheckCircle2 size={13} /> Open
                      </span>
                    ) : null}
                    <span className={isPreview ? "text-[10px] font-bold uppercase tracking-wider text-amber-400" : "text-[10px] font-bold uppercase tracking-wider text-neutral-500"}>
                      {isPreview ? "Preview locked" : membership.role}
                    </span>
                    <ArrowRight size={16} className="text-neutral-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Create or join a workspace before using requests, tickets, review, and settings.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
            <Building2 size={20} />
          </div>
          <h2 className="text-xl font-bold text-white">Create workspace</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-6">Start a new organization workspace. You will become its owner.</p>
          <form action={createWorkspaceAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-neutral-300">Workspace name</label>
              <input id="name" name="name" required minLength={2} maxLength={80} placeholder="Acme Clinic" className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500" />
            </div>
            <SubmitButton pendingText="Creating workspace...">
              <PlusCircle size={16} /> Create workspace
            </SubmitButton>
          </form>
        </section>

        <section className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
            <Link2 size={20} />
          </div>
          <h2 className="text-xl font-bold text-white">Join with invite</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-6">Enter a valid invite code or paste the full invite link from a workspace owner or admin.</p>
          <form action={joinWorkspaceAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-semibold text-neutral-300">Invite code or link</label>
              <input id="code" name="code" required minLength={6} maxLength={500} placeholder={DEMO_WORKSPACE_INVITE_CODE} className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500" />
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
