import { ShieldCheck, UserCog, UserMinus } from "lucide-react";
import { removeWorkspaceMemberAction, updateUserRoleAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { requireWorkspaceAdminContext } from "@/lib/auth";
import { listWorkspaceMembers, canRemoveWorkspaceMember } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function UsersPageView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { user: currentUser, workspace, membership } = await requireWorkspaceAdminContext(workspaceSlug);
  const users = await listWorkspaceMembers(workspace.id, currentUser.id);
  const canEditRoles = membership.role === "owner";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">User Management</h1>
          <p className="text-muted mt-1">Manage active members and workspace roles for {workspace.name}.</p>
        </div>
      </div>

      <div className="bg-surface rounded-[var(--radius-card)] border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-surface-2">
          <h2 className="font-medium text-fg flex items-center gap-2">
            <UserCog size={17} className="text-accent" /> Accounts ({users.length})
          </h2>
        </div>

        <div className="divide-y divide-border">
          {users.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="font-medium text-fg">No accounts found</h3>
              <p className="text-sm text-muted mt-1">Users will appear here after signup.</p>
            </div>
          ) : (
            users.map((user) => {
              const isSelf = user.userId === currentUser.id;
              const isOwner = user.role === "owner";
              const roleLocked = !canEditRoles || isSelf || isOwner;
              const canRemove = !isSelf && canRemoveWorkspaceMember(membership.role, user.role);
              return (
                <div key={user.id} className="p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-fg truncate">{user.displayName || user.email}</h3>
                      <span className="bg-surface-hover text-muted text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide uppercase">
                        {user.role}
                      </span>
                      {isSelf ? (
                        <span className="bg-accent-soft text-accent border border-accent-border text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide uppercase">
                          You
                        </span>
                      ) : null}
                      {isOwner ? (
                        <span className="st-warn border text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide uppercase">
                          Protected
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted">{user.email}</p>
                    <p className="font-mono text-xs text-faint mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <form action={updateUserRoleAction} className="flex items-center gap-3">
                      {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
                      <input type="hidden" name="userId" value={user.userId} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={roleLocked}
                        className="h-10 bg-bg border border-border rounded-[var(--radius-control)] px-3 text-sm text-fg focus:outline-none focus:border-accent-border disabled:cursor-not-allowed disabled:text-faint"
                      >
                        <option value="requester">Requester</option>
                        <option value="admin">Admin</option>
                        {isOwner ? <option value="owner">Owner</option> : null}
                      </select>
                      <SubmitButton
                        pendingText="Saving role..."
                        disabled={roleLocked}
                        className="btn--neutral"
                      >
                        Save Role
                      </SubmitButton>
                    </form>
                    {canRemove ? (
                      <form action={removeWorkspaceMemberAction}>
                        {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <input type="hidden" name="memberUserId" value={user.userId} />
                        <ConfirmSubmitButton confirmation={`Remove ${user.displayName || user.email || "this member"} from ${workspace.name}?`} pendingText="Removing..." className="st-danger h-10 px-4 rounded-[var(--radius-control)] border text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-75">
                          <UserMinus size={15} /> Remove
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6 flex gap-4">
        <ShieldCheck size={20} className="text-accent flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="font-medium text-fg">Role policy</h2>
          <p className="text-sm text-muted mt-1">
            Workspace owners can assign requester/admin roles. Admins can remove requester members. Owner access cannot be changed here.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function UsersPage() {
  return <UsersPageView />;
}
