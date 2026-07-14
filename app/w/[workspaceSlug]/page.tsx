import Link from "next/link";
import { AlertTriangle, ArrowLeft, Link2, LogOut, Trash2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createWorkspaceInviteAction, deleteWorkspaceAction, deleteWorkspaceInviteAction, leaveWorkspaceAction, revokeWorkspaceInviteAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyInviteButton } from "@/components/copy-invite-button";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { workspaceSlugSchema } from "@/lib/schema";
import { canManageWorkspaceInvite, countWorkspaceMembers, getWorkspaceBySlug, getWorkspaceMembership, isWorkspaceAdmin, isWorkspaceInviteActive, isWorkspacePreview, listWorkspaceInvites, MAX_ACTIVE_WORKSPACE_INVITES, MAX_WORKSPACE_MEMBERS, workspaceInviteLink } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

const ROLE_HUE: Record<string, string> = { owner: "active", admin: "info", requester: "neutral" };

function inviteStatus(invite: { revokedAt?: string; expiresAt?: string; usedAt?: string; isReusable: boolean }) {
  if (invite.revokedAt) return "Revoked";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return "Expired";
  if (invite.usedAt && !invite.isReusable) return "Used";
  return "Active";
}

function statusHue(status: string) {
  if (status === "Active") return "active";
  if (status === "Revoked") return "danger";
  return "neutral";
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
  const memberCount = canManageInvites ? await countWorkspaceMembers(workspace.id) : 0;
  const activeInviteCount = invites.filter((invite) => isWorkspaceInviteActive(invite)).length;
  const inviteLimitReached = activeInviteCount >= MAX_ACTIVE_WORKSPACE_INVITES;
  const memberLimitReached = memberCount >= MAX_WORKSPACE_MEMBERS;
  const newInviteLink = query.invite ? workspaceInviteLink(workspace.slug, query.invite) : null;

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <Link href="/onboarding" className="cluster muted" style={{ gap: 8, fontSize: 13, fontWeight: 550, width: "fit-content", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Back to workspaces
      </Link>

      <div className="page-head">
        <div className="eyebrow">Workspace</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {workspace.name}
        </h1>
        <p className="page-sub">
          Share access, manage invites, and control your membership. <span className="mono">/{workspace.slug}</span>
        </p>
      </div>

      {query.error ? (
        <div className="st-danger rounded-[var(--radius-card)] border px-4 py-3 text-sm" style={{ marginBottom: 18 }}>
          {query.error}
        </div>
      ) : null}

      {isPreview ? (
        <div className="banner" style={{ marginBottom: 18 }}>
          <Link2 size={16} /> This is a read-only preview. Sharing and deletion are disabled.
        </div>
      ) : null}

      <div className="split">
        <div className="stack" style={{ gap: 16 }}>
          {canManageInvites ? (
            <>
              <div className="card">
                <div className="panel-head">
                  <div className="section-title">Share workspace</div>
                  <span className="badge" data-hue={memberLimitReached ? "danger" : "neutral"}>
                    {memberCount} / {MAX_WORKSPACE_MEMBERS} members
                  </span>
                </div>
                <div className="card-pad">
                  <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
                    Generate a single-use invite link. It expires after 7 days or once someone joins.
                  </p>
                  <form action={createWorkspaceInviteAction} className="cluster wrap" style={{ gap: 10, alignItems: "flex-end" }}>
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                    <div className="field grow" style={{ minWidth: 160 }}>
                      <label htmlFor="role" className="label">
                        Role for invitee
                      </label>
                      <select id="role" name="role" className="select">
                        <option value="requester">Requester</option>
                        {membership.role === "owner" ? <option value="admin">Admin</option> : null}
                      </select>
                    </div>
                    <SubmitButton pendingText="Creating..." className="btn--sm w-auto" disabled={inviteLimitReached || memberLimitReached}>
                      <Link2 size={14} /> Create invite
                    </SubmitButton>
                  </form>

                  {memberLimitReached ? (
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                      This workspace is full ({MAX_WORKSPACE_MEMBERS} members). Remove a member before inviting someone new.
                    </p>
                  ) : inviteLimitReached ? (
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                      You have {MAX_ACTIVE_WORKSPACE_INVITES} pending invites. Delete or revoke one to create another.
                    </p>
                  ) : null}

                  {newInviteLink ? (
                    <div className="callout callout--accent" style={{ marginTop: 16 }}>
                      <div className="eyebrow">New invite link</div>
                      <div className="copy-code" style={{ marginTop: 8 }}>
                        {newInviteLink}
                      </div>
                      <div className="cluster" style={{ gap: 10, marginTop: 10 }}>
                        <CopyInviteButton value={newInviteLink} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="card">
                <div className="panel-head">
                  <div className="section-title">Invites</div>
                  <span className="eyebrow">{activeInviteCount} / {MAX_ACTIVE_WORKSPACE_INVITES} active · {invites.length} total</span>
                </div>
                {invites.length === 0 ? (
                  <div className="card-pad">
                    <p className="muted" style={{ fontSize: 13 }}>
                      No invites yet.
                    </p>
                  </div>
                ) : (
                  <div className="list">
                    {invites.map((invite) => {
                      const link = workspaceInviteLink(workspace.slug, invite.code);
                      const status = inviteStatus(invite);
                      const active = isWorkspaceInviteActive(invite);
                      const canManage = canManageWorkspaceInvite(membership.role, user.id, invite);
                      return (
                        <div key={invite.id} className="row-link" style={{ cursor: "default" }}>
                          <div className="between wrap" style={{ gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div className="cluster wrap" style={{ gap: 8 }}>
                                <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                                  {invite.code}
                                </span>
                                <span className="badge" data-hue={statusHue(status)}>
                                  {status}
                                </span>
                                <span className="badge" data-hue={ROLE_HUE[invite.role] ?? "neutral"}>
                                  {invite.role}
                                </span>
                              </div>
                              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                                {invite.isReusable ? "Reusable demo invite" : `Expires ${invite.expiresAt ? formatDate(invite.expiresAt) : "never"}`}
                              </div>
                            </div>
                            <div className="cluster" style={{ gap: 6 }}>
                              <CopyInviteButton value={link} />
                              {canManage && active ? (
                                <form action={revokeWorkspaceInviteAction}>
                                  <input type="hidden" name="workspaceId" value={workspace.id} />
                                  <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                                  <input type="hidden" name="inviteId" value={invite.id} />
                                  <button className="btn btn--sm">Revoke</button>
                                </form>
                              ) : null}
                              {canManage ? (
                                <form action={deleteWorkspaceInviteAction}>
                                  <input type="hidden" name="workspaceId" value={workspace.id} />
                                  <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                                  <input type="hidden" name="inviteId" value={invite.id} />
                                  <ConfirmSubmitButton confirmation={`Remove invite ${invite.code}? This cannot be undone.`} className="btn btn--sm btn--danger">
                                    <Trash2 size={13} />
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card card-pad">
              <div className="section-title">Workspace access</div>
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                {isPreview
                  ? "Demo Clinic is a read-only preview. Create your own workspace to invite members and use workspace management actions."
                  : "Requesters can submit requests and view their own tickets. Workspace invite sharing is available to admins and owners."}
              </p>
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 16, alignSelf: "start" }}>
          <div className="card card-pad">
            <div className="section-title" style={{ marginBottom: 10 }}>
              Your membership
            </div>
            <div className="cluster between">
              <span className="muted" style={{ fontSize: 13.5 }}>
                Role in this workspace
              </span>
              <span className="badge" data-hue={ROLE_HUE[membership.role] ?? "neutral"}>
                {membership.role}
              </span>
            </div>
            {membership.role !== "owner" ? (
              <>
                <div className="divider" style={{ margin: "14px 0" }} />
                <form action={leaveWorkspaceAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                  <ConfirmSubmitButton confirmation={`Leave ${workspace.name}? You will need a new valid invite to join again.`} className="btn btn--neutral btn--sm btn--block">
                    <LogOut size={14} /> Leave workspace
                  </ConfirmSubmitButton>
                </form>
              </>
            ) : null}
          </div>

          {membership.role === "owner" && !isPreview ? (
            <div className="card card-pad" style={{ borderColor: "color-mix(in srgb, var(--danger) 30%, var(--border))" }}>
              <div className="cluster" style={{ gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
                <div className="section-title">Danger zone</div>
              </div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                Deleting a workspace removes all its tickets, requests, members, and invites. This can&apos;t be undone.
              </p>
              <form action={deleteWorkspaceAction} className="stack" style={{ gap: 10 }}>
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="workspaceSlug" value={workspace.slug} />
                <div className="field">
                  <label htmlFor="confirmation" className="label">
                    Type <span className="mono" style={{ color: "var(--danger)" }}>{workspace.slug}</span> to confirm
                  </label>
                  <input id="confirmation" name="confirmation" required autoComplete="off" placeholder={workspace.slug} className="input" />
                </div>
                <SubmitButton pendingText="Deleting workspace..." className="btn--danger btn--sm btn--block">
                  <Trash2 size={14} /> Delete workspace
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
