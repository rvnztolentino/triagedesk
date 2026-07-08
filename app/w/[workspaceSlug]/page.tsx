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
  const canManageUsers = isWorkspaceAdmin(membership.role);
  const canManageInvites = !isPreview && isWorkspaceAdmin(membership.role);
  const invites = canManageInvites ? await listWorkspaceInvites(workspace.id, user.id) : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Link href="/onboarding" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg transition-colors">
        <ArrowLeft size={16} /> Back to workspace dashboard
      </Link>

      <section className="bg-surface border border-border rounded-[var(--radius-card)] p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
              <Building2 size={14} /> Workspace overview
            </div>
            <h1 className="text-2xl font-semibold text-fg mt-3">{workspace.name}</h1>
            <p className="text-sm text-muted mt-2">
              Workspace slug: <span className="font-mono text-fg">{workspace.slug}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-9 px-3 rounded-[var(--radius-control)] bg-surface-hover border border-border font-mono text-xs font-medium uppercase tracking-[0.1em] text-muted inline-flex items-center">
              {isPreview ? "Preview locked" : membership.role}
            </span>
            <form action={activateWorkspaceAction}>
              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
              <SubmitButton pendingText={isPreview ? "Opening preview..." : "Opening operations..."} className="w-auto h-10 px-4">
                {isPreview ? "Open preview" : "Open operations"} <ArrowRight size={15} />
              </SubmitButton>
            </form>
          </div>
        </div>
      </section>

      {query.error ? (
        <div className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm">{query.error}</div>
      ) : null}

      {isPreview ? (
        <div className="st-warn rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <LockKeyhole size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Read-only preview.</span> Demo Clinic shows the full sample workflow, but requests, reviews, updates, invitations, and workspace management actions are locked.</p>
        </div>
      ) : null}

      {query.invite ? (
        <div className="rounded-[var(--radius-control)] border border-accent-border bg-accent-soft px-4 py-3 text-sm text-accent">
          Invite created: <span className="font-mono font-medium">{query.invite}</span>
        </div>
      ) : null}

      {canManageUsers ? (
        <section className="bg-surface border border-border rounded-[var(--radius-card)] p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium text-fg flex items-center gap-2">
              <Users size={17} className="text-accent" /> Workspace users
            </h2>
            <p className="text-sm text-muted mt-1">Review members, roles, and removals from User Management.</p>
          </div>
          <Link href={`/w/${workspace.slug}/users`} className="h-10 px-4 rounded-[var(--radius-control)] bg-surface-hover border border-border text-sm font-medium text-fg hover:bg-surface transition-colors inline-flex items-center justify-center gap-2">
            Manage users <ArrowRight size={15} />
          </Link>
        </section>
      ) : null}

      {canManageInvites ? (
        <section className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
            <div className="flex items-center gap-2 mb-5">
              <PlusCircle size={17} className="text-accent" />
              <h2 className="font-medium text-fg">Share workspace</h2>
            </div>
            <p className="text-sm text-muted mb-5">Create a seven-day, one-time invite link. Membership role always comes from the invite.</p>
            <form action={createWorkspaceInviteAction} className="space-y-4">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-medium text-fg">Invite role</label>
                <select id="role" name="role" className="select">
                  <option value="requester">Requester</option>
                  {membership.role === "owner" ? <option value="admin">Admin</option> : null}
                </select>
              </div>
              <SubmitButton pendingText="Creating invite...">
                <Link2 size={16} /> Create invite link
              </SubmitButton>
            </form>
          </div>

          <div className="bg-surface border border-border rounded-[var(--radius-card)] overflow-hidden">
            <div className="p-6 border-b border-border bg-surface-2">
              <h2 className="font-medium text-fg flex items-center gap-2">
                <ShieldCheck size={17} className="text-accent" /> Workspace invites ({invites.length})
              </h2>
            </div>
            <div className="divide-y divide-border">
              {invites.length === 0 ? (
                <div className="p-8 text-sm text-muted">No workspace invites yet.</div>
              ) : (
                invites.map((invite) => {
                  const link = workspaceInviteLink(workspace.slug, invite.code);
                  const active = isWorkspaceInviteActive(invite);
                  return (
                    <div key={invite.id} className="p-5 space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-fg">{invite.code}</span>
                            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{invite.role}</span>
                            <span className={active ? "font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-accent" : "font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint"}>
                              {inviteStatus(invite)}
                            </span>
                          </div>
                          <p className="text-xs text-faint mt-1">{invite.isReusable ? "Reusable demo invite" : `Expires ${invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "never"}`}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <CopyInviteButton value={link} />
                          {membership.role === "owner" && active ? (
                            <form action={revokeWorkspaceInviteAction}>
                              <input type="hidden" name="workspaceId" value={workspace.id} />
                              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                              <input type="hidden" name="inviteId" value={invite.id} />
                              <button className="st-danger h-9 px-3 rounded-[var(--radius-control)] border text-xs font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                                <Trash2 size={14} /> Revoke
                              </button>
                            </form>
                          ) : null}
                          {membership.role === "owner" ? (
                            <form action={deleteWorkspaceInviteAction}>
                              <input type="hidden" name="workspaceId" value={workspace.id} />
                              <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                              <input type="hidden" name="inviteId" value={invite.id} />
                              <ConfirmSubmitButton confirmation={`Remove invite ${invite.code}? This cannot be undone.`} className="h-9 px-3 rounded-[var(--radius-control)] border border-border text-xs font-medium text-muted hover:bg-surface-hover hover:text-fg transition-colors inline-flex items-center gap-2">
                                <Trash2 size={14} /> Remove
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      <p className="font-mono text-xs text-muted break-all">{link}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
          <h2 className="font-medium text-fg">Workspace access</h2>
          <p className="text-sm text-muted mt-2">
            {isPreview
              ? "Demo Clinic is a read-only preview. Create your own workspace to invite members and use workspace management actions."
              : "Requesters can submit requests and view their own tickets. Workspace invite sharing is available to admins and owners."}
          </p>
        </section>
      )}

      {membership.role !== "owner" ? (
        <section className="bg-surface border border-border rounded-[var(--radius-card)] p-6">
          <div className="flex items-center gap-2 mb-3">
            <LogOut size={17} className="text-muted" />
            <h2 className="font-medium text-fg">Leave workspace</h2>
          </div>
          <p className="text-sm text-muted">Remove your membership from this workspace. You will need a new valid invite to join again.</p>
          <form action={leaveWorkspaceAction} className="mt-5">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="workspaceSlug" value={workspace.slug} />
            <ConfirmSubmitButton confirmation={`Leave ${workspace.name}? You will need a new valid invite to join again.`} className="h-11 px-4 rounded-[var(--radius-control)] text-sm font-medium inline-flex items-center justify-center gap-2 sm:w-auto border border-border bg-surface-hover text-fg hover:bg-surface transition-colors">
              <LogOut size={16} /> Leave workspace
            </ConfirmSubmitButton>
          </form>
        </section>
      ) : null}

      {membership.role === "owner" && !isPreview ? (
        <section className="bg-surface border border-[var(--st-danger)]/40 rounded-[var(--radius-card)] p-6">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={17} className="text-[var(--st-danger)]" />
            <h2 className="font-medium text-fg">Delete workspace</h2>
          </div>
          <p className="text-sm text-muted">
            Permanently delete this workspace and its associated requests, tickets, activity, metadata, invitations, memberships, and tracked uploads.
          </p>
          <form action={deleteWorkspaceAction} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <input type="hidden" name="workspaceSlug" value={workspace.slug} />
            <div className="space-y-2 flex-1">
              <label htmlFor="confirmation" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">
                Type <span className="font-mono text-[var(--st-danger)]">{workspace.slug}</span> to confirm
              </label>
              <input id="confirmation" name="confirmation" required autoComplete="off" className="input" />
            </div>
            <SubmitButton pendingText="Deleting workspace..." className="btn--danger btn--block sm:w-auto sm:min-w-48">
              <Trash2 size={16} /> Delete permanently
            </SubmitButton>
          </form>
        </section>
      ) : null}
    </div>
  );
}
