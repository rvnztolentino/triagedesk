import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Link2, LockKeyhole, LogOut, PlusCircle, ShieldCheck, Trash2, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { activateWorkspaceAction, createWorkspaceInviteAction, deleteWorkspaceAction, deleteWorkspaceInviteAction, leaveWorkspaceAction, revokeWorkspaceInviteAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { workspaceSlugSchema } from "@/lib/schema";
import { getWorkspaceBySlug, getWorkspaceMembership, isWorkspaceAdmin, isWorkspaceInviteActive, isWorkspacePreview, listWorkspaceInvites, workspaceInviteLink } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

function inviteStatus(invite: { revokedAt?: string; expiresAt?: string; usedAt?: string; isReusable: boolean }) {
  if (invite.revokedAt) return "Revoked";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return "Expired";
  if (invite.usedAt && !invite.isReusable) return "Used";
  return "Active";
}

export default async function WorkspaceLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ invite?: string; error?: string }>;
}) {
  const { workspaceSlug: rawWorkspaceSlug } = await params;
  const parsedSlug = workspaceSlugSchema.safeParse(rawWorkspaceSlug);
  if (!parsedSlug.success) notFound();

  const workspaceSlug = parsedSlug.data;
  const user = await requireUser();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  const membership = await getWorkspaceMembership(workspace.id, user.id);
  if (!membership) redirect("/onboarding");

  const query = await searchParams;
  const isPreview = isWorkspacePreview(workspace.id);
  const canManageInvites = !isPreview && isWorkspaceAdmin(membership.role);
  const invites = canManageInvites ? await listWorkspaceInvites(workspace.id, user.id) : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link href="/onboarding" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-white">
        <ArrowLeft size={16} /> Back to workspace dashboard
      </Link>

      <section className="bg-[#111111] border border-neutral-800 rounded-2xl p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              <Building2 size={14} /> Workspace overview
            </div>
            <h1 className="text-3xl font-bold text-white font-space mt-3">{workspace.name}</h1>
            <p className="text-sm text-neutral-500 mt-2">
              Workspace slug: <span className="font-mono text-neutral-300">{workspace.slug}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-9 px-3 rounded-lg bg-neutral-800 border border-neutral-700 text-xs font-bold uppercase tracking-wider text-neutral-300 inline-flex items-center">
              {isPreview ? "Preview locked" : membership.role}
            </span>
            <form action={activateWorkspaceAction}>
              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
              <button className="h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-bold inline-flex items-center gap-2">
                {isPreview ? "Open preview" : "Open operations"} <ArrowRight size={15} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {query.error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{query.error}</div>
      ) : null}

      {isPreview ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex items-start gap-2">
          <LockKeyhole size={15} className="mt-0.5 shrink-0 text-amber-400" />
          <p><span className="font-bold text-amber-300">Read-only preview.</span> Demo Clinic shows the full sample workflow, but requests, reviews, updates, invitations, and workspace management actions are locked.</p>
        </div>
      ) : null}

      {query.invite ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Invite created: <span className="font-mono font-bold">{query.invite}</span>
        </div>
      ) : null}

      <section className="bg-[#111111] border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Users size={17} className="text-emerald-400" /> Workspace users
          </h2>
          <p className="text-sm text-neutral-500 mt-1">Review members, roles, and removals from User Management.</p>
        </div>
        <Link href="/users" className="h-10 px-4 rounded-lg bg-neutral-800 border border-neutral-700 text-sm font-bold text-white hover:bg-neutral-700 inline-flex items-center justify-center gap-2">
          Manage users <ArrowRight size={15} />
        </Link>
      </section>

      {canManageInvites ? (
        <section className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
          <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <PlusCircle size={17} className="text-emerald-400" />
              <h2 className="font-semibold text-white">Share workspace</h2>
            </div>
            <p className="text-sm text-neutral-500 mb-5">Create a seven-day, one-time invite link. Membership role always comes from the invite.</p>
            <form action={createWorkspaceInviteAction} className="space-y-4">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-semibold text-neutral-300">Invite role</label>
                <select id="role" name="role" className="w-full h-11 bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="requester">Requester</option>
                  {membership.role === "owner" ? <option value="admin">Admin</option> : null}
                </select>
              </div>
              <SubmitButton pendingText="Creating invite...">
                <Link2 size={16} /> Create invite link
              </SubmitButton>
            </form>
          </div>

          <div className="bg-[#111111] border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-neutral-800 bg-[#151515]">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <ShieldCheck size={17} className="text-emerald-400" /> Workspace invites ({invites.length})
              </h2>
            </div>
            <div className="divide-y divide-neutral-800">
              {invites.length === 0 ? (
                <div className="p-8 text-sm text-neutral-500">No workspace invites yet.</div>
              ) : (
                invites.map((invite) => {
                  const link = workspaceInviteLink(workspace.slug, invite.code);
                  const active = isWorkspaceInviteActive(invite);
                  return (
                    <div key={invite.id} className="p-5 space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-white">{invite.code}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{invite.role}</span>
                            <span className={active ? "text-[10px] font-bold uppercase tracking-wider text-emerald-400" : "text-[10px] font-bold uppercase tracking-wider text-neutral-600"}>
                              {inviteStatus(invite)}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 mt-1">{invite.isReusable ? "Reusable demo invite" : `Expires ${invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "never"}`}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <CopyInviteButton value={link} />
                          {membership.role === "owner" && active ? (
                            <form action={revokeWorkspaceInviteAction}>
                              <input type="hidden" name="workspaceId" value={workspace.id} />
                              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                              <input type="hidden" name="inviteId" value={invite.id} />
                              <button className="h-9 px-3 rounded-lg border border-rose-500/30 text-xs font-bold text-rose-300 hover:bg-rose-500/10 inline-flex items-center gap-2">
                                <Trash2 size={14} /> Revoke
                              </button>
                            </form>
                          ) : null}
                          {membership.role === "owner" ? (
                            <form action={deleteWorkspaceInviteAction}>
                              <input type="hidden" name="workspaceId" value={workspace.id} />
                              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                              <input type="hidden" name="inviteId" value={invite.id} />
                              <ConfirmSubmitButton confirmation={`Remove invite ${invite.code}? This cannot be undone.`} className="h-9 px-3 rounded-lg border border-neutral-700 text-xs font-bold text-neutral-300 hover:bg-neutral-800 inline-flex items-center gap-2">
                                <Trash2 size={14} /> Remove
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      <p className="font-mono text-xs text-neutral-500 break-all">{link}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
          <h2 className="font-semibold text-white">Workspace access</h2>
          <p className="text-sm text-neutral-500 mt-2">
            {isPreview
              ? "Demo Clinic is a read-only preview. Create your own workspace to invite members and use workspace management actions."
              : "Requesters can submit requests and view their own tickets. Workspace invite sharing is available to admins and owners."}
          </p>
        </section>
      )}

      {membership.role !== "owner" ? (
        <section className="bg-[#111111] border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <LogOut size={17} className="text-neutral-400" />
            <h2 className="font-semibold text-white">Leave workspace</h2>
          </div>
          <p className="text-sm text-neutral-500">Remove your membership from this workspace. You will need a new valid invite to join again.</p>
          <form action={leaveWorkspaceAction} className="mt-5">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="workspaceSlug" value={workspace.slug} />
            <ConfirmSubmitButton confirmation={`Leave ${workspace.name}? You will need a new valid invite to join again.`} className="h-11 px-4 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 sm:w-auto border border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700">
              <LogOut size={16} /> Leave workspace
            </ConfirmSubmitButton>
          </form>
        </section>
      ) : null}

      {membership.role === "owner" && !isPreview ? (
        <section className="bg-[#111111] border border-rose-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={17} className="text-rose-300" />
            <h2 className="font-semibold text-white">Delete workspace</h2>
          </div>
          <p className="text-sm text-neutral-500">
            Permanently delete this workspace and its associated requests, tickets, activity, metadata, invitations, memberships, and tracked uploads.
          </p>
          <form action={deleteWorkspaceAction} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="workspaceSlug" value={workspace.slug} />
            <div className="space-y-2 flex-1">
              <label htmlFor="confirmation" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Type <span className="font-mono text-rose-300">{workspace.slug}</span> to confirm
              </label>
              <input id="confirmation" name="confirmation" required autoComplete="off" className="h-11 w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-rose-500" />
            </div>
            <SubmitButton pendingText="Deleting workspace..." className="sm:w-auto sm:min-w-48 bg-rose-500 hover:bg-rose-600 text-white">
              <Trash2 size={16} /> Delete permanently
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}
