import Link from "next/link";
import { Check, Link2, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { removeWorkspaceMemberAction, updateUserRoleAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { isDemoUser, requireWorkspaceAdminContext } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { AppUser, WorkspaceMemberSummary } from "@/lib/schema";
import { listWorkspaceMembers, canRemoveWorkspaceMember, isWorkspaceAdmin, isWorkspacePreview, MAX_WORKSPACE_MEMBERS } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

const ROLE_HUE: Record<string, string> = {
  owner: "active",
  admin: "info",
  requester: "neutral",
};

function initials(label: string) {
  return (
    label
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const rolePolicies = [
  { role: "owner", points: ["Full control of the workspace", "Edits any role, removes any member", "Protected, cannot be removed"] },
  { role: "admin", points: ["Reviews and resolves tickets", "Manages settings & departments", "Can remove requesters"] },
  { role: "requester", points: ["Submits new requests", "Tracks their own tickets", "No management access"] },
];

function Policy({ role, points }: { role: string; points: string[] }) {
  return (
    <div className="callout">
      <span className="badge" data-hue={ROLE_HUE[role] ?? "neutral"}>
        {capitalize(role)}
      </span>
      <ul style={{ listStyle: "none", marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {points.map((point) => (
          <li key={point} className="cluster" style={{ gap: 8, alignItems: "flex-start" }}>
            <Check size={14} style={{ color: "var(--done)", marginTop: 3, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The demo workspace is a shared read-only preview, so it must never expose the
// real people who happen to be poking at it. Show the visitor as the owner and
// pad the roster with a fixed, obviously-sample cast. All actions stay disabled.
function previewMembers(workspaceId: string, currentUser: AppUser): WorkspaceMemberSummary[] {
  const base = { workspaceId, createdAt: "2026-01-06T09:00:00.000Z" };
  return [
    {
      ...base,
      id: "preview-owner",
      userId: currentUser.id,
      role: "owner",
      email: currentUser.email,
      displayName: currentUser.displayName || currentUser.email.split("@")[0],
    },
    { ...base, id: "preview-admin", userId: "preview-admin", role: "admin", email: "avery.stone@demo-clinic.example", displayName: "Avery Stone", createdAt: "2026-01-07T09:00:00.000Z" },
    { ...base, id: "preview-req-1", userId: "preview-req-1", role: "requester", email: "jordan.lee@demo-clinic.example", displayName: "Jordan Lee", createdAt: "2026-01-08T09:00:00.000Z" },
    { ...base, id: "preview-req-2", userId: "preview-req-2", role: "requester", email: "morgan.diaz@demo-clinic.example", displayName: "Morgan Diaz", createdAt: "2026-01-09T09:00:00.000Z" },
    { ...base, id: "preview-req-3", userId: "preview-req-3", role: "requester", email: "sam.rivera@demo-clinic.example", displayName: "Sam Rivera", createdAt: "2026-01-10T09:00:00.000Z" },
  ];
}

export async function UsersPageView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { user: currentUser, workspace, membership } = await requireWorkspaceAdminContext(workspaceSlug);
  const isPreview = isWorkspacePreview(workspace.id);
  const users = isPreview ? previewMembers(workspace.id, currentUser) : await listWorkspaceMembers(workspace.id, currentUser.id);
  const canEditRoles = !isPreview && membership.role === "owner";
  // Same gate the workspace page puts on invite management, so the button never
  // sends anyone to a page where the invite controls are hidden. A preview
  // workspace lets requesters in here, so the role check is not redundant.
  const canManageInvites = !isPreview && !isDemoUser(currentUser) && isWorkspaceAdmin(membership.role);

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5">
      <div className="page-head between wrap" style={{ gap: 14 }}>
        <div>
          <div className="eyebrow">Members</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            People in {workspace.name}
          </h1>
          <p className="page-sub">
            {isPreview
              ? `${users.length} member${users.length === 1 ? "" : "s"}. Owners manage roles; admins can remove requesters.`
              : `${users.length} / ${MAX_WORKSPACE_MEMBERS} members. Owners manage roles; admins can remove requesters.`}
          </p>
        </div>
        {canManageInvites ? (
          <Link href={`/w/${workspace.slug}`} prefetch={false} className="btn btn--primary">
            <UserPlus size={16} /> Invite members
          </Link>
        ) : null}
      </div>

      {isPreview ? (
        <div className="banner">
          <Link2 size={16} /> This is a read-only preview. Sample members are shown and management actions are disabled.
        </div>
      ) : null}

      <div className="split">
        <div className="card list">
          {users.length === 0 ? (
            <div className="empty">
              <div className="empty-glyph">
                <ShieldCheck size={22} />
              </div>
              <div style={{ fontWeight: 600, color: "var(--fg)" }}>No accounts found</div>
              <div style={{ fontSize: 13.5 }}>Members will appear here after they sign up or accept an invite.</div>
            </div>
          ) : (
            users.map((user) => {
              const isSelf = user.userId === currentUser.id;
              const isOwner = user.role === "owner";
              const roleLocked = !canEditRoles || isSelf || isOwner;
              const canRemove = !isPreview && !isSelf && canRemoveWorkspaceMember(membership.role, user.role);
              return (
                <div key={user.id} className="row-link" style={{ cursor: "default" }}>
                  <div className="between wrap" style={{ gap: 12 }}>
                    <div className="cluster" style={{ gap: 12, minWidth: 0 }}>
                      <span className="avatar lg">{initials(user.displayName || user.email)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="cluster wrap" style={{ gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{user.displayName || user.email}</span>
                          {isSelf ? (
                            <span className="badge" data-hue="accent">
                              You
                            </span>
                          ) : null}
                          {isOwner ? (
                            <span className="badge" data-hue="active">
                              <ShieldCheck size={11} /> Protected
                            </span>
                          ) : null}
                        </div>
                        <div className="muted" style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {user.email} · joined {formatDate(user.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="cluster" style={{ gap: 10 }}>
                      {!roleLocked ? (
                        <form action={updateUserRoleAction} className="cluster" style={{ gap: 8 }}>
                          {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
                          <input type="hidden" name="userId" value={user.userId} />
                          <select name="role" defaultValue={user.role} className="select" style={{ width: "auto" }}>
                            <option value="requester">Requester</option>
                            <option value="admin">Admin</option>
                          </select>
                          <SubmitButton pendingText="Saving…" className="btn--neutral btn--sm">
                            Save
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="badge" data-hue={ROLE_HUE[user.role] ?? "neutral"}>
                          {user.role}
                        </span>
                      )}
                      {canRemove ? (
                        <form action={removeWorkspaceMemberAction}>
                          {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="memberUserId" value={user.userId} />
                          <ConfirmSubmitButton
                            confirmation={`Remove ${user.displayName || user.email || "this member"} from ${workspace.name}?`}
                            pendingText="Removing…"
                            className="btn btn--danger btn--sm"
                          >
                            <UserMinus size={14} />
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="card card-pad" style={{ alignSelf: "start" }}>
          <div className="section-title" style={{ marginBottom: 4 }}>
            Role policy
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
            What each role can do in this workspace.
          </p>
          <div className="stack" style={{ gap: 14 }}>
            {rolePolicies.map((policy) => (
              <Policy key={policy.role} role={policy.role} points={policy.points} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function UsersPage() {
  return <UsersPageView />;
}
