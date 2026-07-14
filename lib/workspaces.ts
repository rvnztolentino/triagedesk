import { requireSupabaseAdminClient } from "@/lib/supabase";
import { PublicError } from "@/lib/errors";
import {
  notifyMemberJoined,
  notifyMemberLeft,
  notifyMemberRemoved,
  notifyMemberRoleChanged,
} from "@/lib/notifications";
import {
  workspaceCreateSchema,
  workspaceDeleteSchema,
  workspaceInviteCodeSchema,
  workspaceInviteCreateSchema,
  workspaceInviteRevokeSchema,
  workspaceJoinSchema,
  workspaceMemberLeaveSchema,
  workspaceMemberRemoveSchema,
  workspaceMemberRoleUpdateSchema,
  workspaceSlugSchema,
  type AssignableUserRole,
  type UserRole,
  type WorkspaceInviteRecord,
  type WorkspaceMemberRecord,
  type WorkspaceMemberSummary,
  type WorkspaceRecord,
} from "@/lib/schema";

// Max workspaces a single user may own/create. Bounds per-user footprint on the
// Supabase + Vercel free tiers (row counts, storage, function invocations).
export const MAX_WORKSPACES_PER_USER = 3;

// Max members in a single workspace, owner included. The heavy free-tier cost
// (Groq triage, storage) is already bounded by the per-workspace daily request +
// upload caps, so this mainly bounds auth rows and notification fan-out. Keep in
// sync with the hard cap enforced inside the join_workspace_by_invite RPC.
export const MAX_WORKSPACE_MEMBERS = 20;

// Max invites that can be outstanding (not used, revoked, or expired) at once.
// Admins/owners must let one lapse, revoke, or delete it to mint another; stops
// unbounded invite-row growth while leaving room to onboard a full workspace.
export const MAX_ACTIVE_WORKSPACE_INVITES = 5;

// Max custom (non-default) departments per workspace. The default departments are
// always present and don't count, so a workspace holds up to this many admin-added
// departments on top of them. Bounds department-row growth per workspace.
export const MAX_CUSTOM_WORKSPACE_DEPARTMENTS = 10;

export const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_WORKSPACE_SLUG = "demo-clinic";
export const DEMO_WORKSPACE_INVITE_CODE = "DEMO-CLINIC-2026";
export const DEMO_PREVIEW_LOCK_MESSAGE = "Demo Clinic is a read-only preview workspace. Create your own workspace to use actions.";

type SupabaseRow = Record<string, unknown>;
type WorkspaceAccess = { workspace: WorkspaceRecord; membership: WorkspaceMemberRecord };

export function isWorkspacePreview(workspaceId: string) {
  return workspaceId === DEMO_WORKSPACE_ID;
}

export function assertWorkspaceMutable(workspaceId: string) {
  if (isWorkspacePreview(workspaceId)) {
    throw new Error(DEMO_PREVIEW_LOCK_MESSAGE);
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asUserRole(value: unknown): UserRole {
  return value === "owner" || value === "admin" ? value : "requester";
}

function asBoolean(value: unknown) {
  return value === true;
}

function workspaceFromRow(row: SupabaseRow): WorkspaceRecord {
  return {
    id: asString(row.id),
    name: asString(row.name),
    slug: asString(row.slug),
    createdBy: row.created_by ? asString(row.created_by) : undefined,
    createdAt: asString(row.created_at),
  };
}

function memberFromRow(row: SupabaseRow): WorkspaceMemberRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    userId: asString(row.user_id),
    role: asUserRole(row.role),
    createdAt: asString(row.created_at),
  };
}

function inviteFromRow(row: SupabaseRow): WorkspaceInviteRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    code: asString(row.code),
    role: asString(row.role) === "admin" ? "admin" : "requester",
    createdBy: row.created_by ? asString(row.created_by) : undefined,
    expiresAt: row.expires_at ? asString(row.expires_at) : undefined,
    usedAt: row.used_at ? asString(row.used_at) : undefined,
    revokedAt: row.revoked_at ? asString(row.revoked_at) : undefined,
    isReusable: asBoolean(row.is_reusable),
    createdAt: asString(row.created_at),
  };
}

function workspaceAccessFromRow(row: SupabaseRow, userId: string): WorkspaceAccess {
  return {
    workspace: {
      id: asString(row.workspace_id),
      name: asString(row.workspace_name),
      slug: asString(row.workspace_slug),
      createdAt: "",
    },
    membership: {
      id: "",
      workspaceId: asString(row.workspace_id),
      userId,
      role: asUserRole(row.membership_role),
      createdAt: "",
    },
  };
}

export async function getWorkspaceById(workspaceId: string) {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client.from("workspaces").select("*").eq("id", workspaceId).maybeSingle();
  if (error) throw new Error(`Get workspace failed: ${error.message}`);
  return data ? workspaceFromRow(data as SupabaseRow) : undefined;
}

export async function getWorkspaceBySlug(workspaceSlug: string) {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client.from("workspaces").select("*").eq("slug", workspaceSlug).maybeSingle();
  if (error) throw new Error(`Get workspace failed: ${error.message}`);
  return data ? workspaceFromRow(data as SupabaseRow) : undefined;
}

export async function listUserWorkspaces(userId: string) {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("workspace_members")
    .select("*, workspaces(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`List user workspaces failed: ${error.message}`);

  return ((data ?? []) as SupabaseRow[]).flatMap((row) => {
    const workspace = row.workspaces;
    if (!workspace || Array.isArray(workspace) || typeof workspace !== "object") return [];
    return [{ workspace: workspaceFromRow(workspace as SupabaseRow), membership: memberFromRow(row) }];
  });
}

// Counts workspaces created (owned) by a user. Drives the creation cap and the
// used/limit indicator on the workspace hub.
export async function countOwnedWorkspaces(userId: string) {
  const client = requireSupabaseAdminClient();
  const { count, error } = await client
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);
  if (error) throw new Error(`Count owned workspaces failed: ${error.message}`);
  return count ?? 0;
}

// Current member count for a workspace. Used to enforce MAX_WORKSPACE_MEMBERS in
// the app layer (the join RPC is the authoritative backstop) and to drive the
// used/limit indicator on the members list.
export async function countWorkspaceMembers(workspaceId: string) {
  const client = requireSupabaseAdminClient();
  const { count, error } = await client
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Count workspace members failed: ${error.message}`);
  return count ?? 0;
}

// Counts invites that are still redeemable (not revoked, not expired, and either
// reusable or unused) — the same predicate as isWorkspaceInviteActive. Drives the
// MAX_ACTIVE_WORKSPACE_INVITES cap and the used/limit indicator.
export async function countActiveWorkspaceInvites(workspaceId: string) {
  const client = requireSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { count, error } = await client
    .from("workspace_invites")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .or("is_reusable.eq.true,used_at.is.null");
  if (error) throw new Error(`Count active workspace invites failed: ${error.message}`);
  return count ?? 0;
}

export async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Get workspace membership failed: ${error.message}`);
  return data ? memberFromRow(data as SupabaseRow) : undefined;
}

// The join_workspace_by_invite RPC raises this text when the code matches no
// active invite; surface it as a clear, user-facing message.
function isInvalidInviteMessage(message: string) {
  return message.includes("invite is invalid or expired") || message.includes("Workspace not found");
}

export function normalizeWorkspaceInviteCode(code: string) {
  const value = code.trim();
  const queryMatch = value.match(/[?&]code=([^&#]+)/);
  const extracted = queryMatch ? decodeURIComponent(queryMatch[1].replace(/\+/g, " ")) : value;
  const parsed = workspaceInviteCodeSchema.safeParse(extracted);
  if (!parsed.success) {
    throw new PublicError("Enter a valid invite code or invite link.");
  }
  return parsed.data.toUpperCase();
}

export async function getWorkspaceInviteByCode(workspaceId: string, code: string) {
  const client = requireSupabaseAdminClient();
  const normalizedCode = normalizeWorkspaceInviteCode(code);
  const { data, error } = await client
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("code", normalizedCode)
    .maybeSingle();
  if (error) throw new Error(`Get workspace invite failed: ${error.message}`);
  return data ? inviteFromRow(data as SupabaseRow) : undefined;
}

export async function getWorkspaceInviteById(workspaceId: string, inviteId: string) {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", inviteId)
    .maybeSingle();
  if (error) throw new Error(`Get workspace invite failed: ${error.message}`);
  return data ? inviteFromRow(data as SupabaseRow) : undefined;
}

export async function listWorkspaceInvites(workspaceId: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership || !isWorkspaceAdmin(membership.role)) {
    throw new Error("Workspace admin access is required.");
  }

  const { data, error } = await client.from("workspace_invites").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw new Error(`List workspace invites failed: ${error.message}`);
  return ((data ?? []) as SupabaseRow[]).map(inviteFromRow);
}

export async function listWorkspaceMembers(workspaceId: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const membership = await getWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    throw new Error("Workspace access is required.");
  }

  const { data, error } = await client
    .from("workspace_members")
    .select("*, user_profiles(id, email, display_name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`List workspace members failed: ${error.message}`);

  return ((data ?? []) as SupabaseRow[]).map((row): WorkspaceMemberSummary => {
    const profile = row.user_profiles;
    const profileRow = profile && !Array.isArray(profile) && typeof profile === "object" ? profile as SupabaseRow : {};
    return {
      ...memberFromRow(row),
      email: asString(profileRow.email),
      displayName: asString(profileRow.display_name),
    };
  });
}

export function isWorkspaceInviteActive(invite: WorkspaceInviteRecord, at = new Date()) {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= at.getTime()) return false;
  return invite.isReusable || !invite.usedAt;
}

export async function requireActiveWorkspaceInvite(workspaceId: string, code: string) {
  const invite = await getWorkspaceInviteByCode(workspaceId, code);
  if (!invite || !isWorkspaceInviteActive(invite)) {
    throw new PublicError("That invite code doesn't exist or has expired.");
  }
  return invite;
}

export function workspaceSlugFromName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54)
    .replace(/-+$/g, "");
  const slug = normalized.length >= 3 ? normalized : `${normalized || "workspace"}-workspace`;
  return workspaceSlugSchema.parse(slug || "workspace");
}

function isDuplicateSlugError(message: string) {
  return message.includes("workspaces_slug_key") || message.includes("duplicate key");
}

export async function createWorkspace(name: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceCreateSchema.parse({ name });

  const ownedCount = await countOwnedWorkspaces(userId);
  if (ownedCount >= MAX_WORKSPACES_PER_USER) {
    throw new PublicError(`You can create up to ${MAX_WORKSPACES_PER_USER} workspaces. Delete one to create another.`);
  }

  const baseSlug = workspaceSlugFromName(input.name);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await client.rpc("create_workspace_with_owner", {
      target_name: input.name,
      target_slug: slug,
      target_user_id: userId,
    });

    if (!error) {
      const row = (data as SupabaseRow[] | null)?.[0];
      if (!row) throw new Error("Create workspace failed.");
      return workspaceAccessFromRow(row, userId);
    }

    if (!isDuplicateSlugError(error.message)) {
      throw new Error(`Create workspace failed: ${error.message}`);
    }
  }

  throw new PublicError("Choose a more specific workspace name.");
}

export async function joinWorkspaceWithInvite(workspaceSlug: string, code: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceJoinSchema.parse({ workspaceSlug, code });
  const normalizedCode = normalizeWorkspaceInviteCode(input.code);
  const { data, error } = await client.rpc("join_workspace_by_invite", {
    target_workspace_slug: input.workspaceSlug,
    target_invite_code: normalizedCode,
    target_user_id: userId,
  });

  if (error) {
    if (isInvalidInviteMessage(error.message)) {
      throw new PublicError("That invite code doesn't exist or has expired.");
    }
    if (error.message.includes("Workspace member limit reached")) {
      throw new PublicError(`This workspace is full (${MAX_WORKSPACE_MEMBERS} members). Ask an admin to remove a member, then try again.`);
    }
    if (error.message.includes("already a member")) {
      throw new PublicError("You're already a member of this workspace.");
    }
    throw new Error(error.message || "Join workspace failed.");
  }
  const row = (data as SupabaseRow[] | null)?.[0];
  if (!row) throw new PublicError("That invite code doesn't exist or has expired.");
  const access = workspaceAccessFromRow(row, userId);
  await notifyMemberJoined(client, { workspaceId: access.workspace.id, memberUserId: userId });
  return access;
}

export async function joinWorkspaceWithInviteCode(code: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const normalizedCode = normalizeWorkspaceInviteCode(code);
  const { data, error } = await client.from("workspace_invites").select("workspace_id").eq("code", normalizedCode).maybeSingle();
  if (error) throw new Error(`Find workspace invite failed: ${error.message}`);
  if (!data) throw new PublicError("That invite code doesn't exist or has expired.");

  const workspace = await getWorkspaceById(asString((data as SupabaseRow).workspace_id));
  if (!workspace) throw new PublicError("That invite code doesn't exist or has expired.");
  return joinWorkspaceWithInvite(workspace.slug, normalizedCode, userId);
}

export async function createWorkspaceInvite(workspaceId: string, role: AssignableUserRole, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceInviteCreateSchema.parse({ workspaceId, role });
  assertWorkspaceMutable(input.workspaceId);
  const membership = await getWorkspaceMembership(input.workspaceId, userId);
  if (!membership || !canCreateWorkspaceInvite(membership.role, input.role)) {
    throw new Error("You cannot create this workspace invite.");
  }

  const [memberCount, activeInvites] = await Promise.all([
    countWorkspaceMembers(input.workspaceId),
    countActiveWorkspaceInvites(input.workspaceId),
  ]);
  if (memberCount >= MAX_WORKSPACE_MEMBERS) {
    throw new PublicError(`This workspace is full (${MAX_WORKSPACE_MEMBERS} members). Remove a member before inviting someone new.`);
  }
  if (activeInvites >= MAX_ACTIVE_WORKSPACE_INVITES) {
    throw new PublicError(`You can have up to ${MAX_ACTIVE_WORKSPACE_INVITES} pending invites. Delete or revoke one to create another.`);
  }

  const invite: WorkspaceInviteRecord = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    code: `TD-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    role: input.role,
    createdBy: userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    isReusable: false,
    createdAt: new Date().toISOString(),
  };
  const { error } = await client.from("workspace_invites").insert({
    id: invite.id,
    workspace_id: invite.workspaceId,
    code: invite.code,
    role: invite.role,
    created_by: invite.createdBy,
    expires_at: invite.expiresAt,
    is_reusable: invite.isReusable,
    created_at: invite.createdAt,
  });
  if (error) throw new Error(`Create workspace invite failed: ${error.message}`);
  return invite;
}

export async function revokeWorkspaceInvite(workspaceId: string, inviteId: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceInviteRevokeSchema.parse({ workspaceId, inviteId });
  assertWorkspaceMutable(input.workspaceId);
  const [membership, invite] = await Promise.all([
    getWorkspaceMembership(input.workspaceId, userId),
    getWorkspaceInviteById(input.workspaceId, input.inviteId),
  ]);
  if (!invite) throw new Error("Workspace invite not found.");
  if (!membership || !canManageWorkspaceInvite(membership.role, userId, invite)) {
    throw new Error("You cannot manage this workspace invite.");
  }

  const revokedAt = new Date().toISOString();
  const { data, error } = await client
    .from("workspace_invites")
    .update({ revoked_at: revokedAt })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.inviteId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Revoke workspace invite failed: ${error.message}`);
  if (!data) throw new Error("Workspace invite not found.");
}

export async function deleteWorkspaceInvite(workspaceId: string, inviteId: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceInviteRevokeSchema.parse({ workspaceId, inviteId });
  assertWorkspaceMutable(input.workspaceId);
  const [membership, invite] = await Promise.all([
    getWorkspaceMembership(input.workspaceId, userId),
    getWorkspaceInviteById(input.workspaceId, input.inviteId),
  ]);
  if (!invite) throw new Error("Workspace invite not found.");
  if (!membership || !canManageWorkspaceInvite(membership.role, userId, invite)) {
    throw new Error("You cannot manage this workspace invite.");
  }

  const { data, error } = await client
    .from("workspace_invites")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.inviteId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Remove workspace invite failed: ${error.message}`);
  if (!data) throw new Error("Workspace invite not found.");
}

export async function leaveWorkspace(workspaceId: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceMemberLeaveSchema.parse({ workspaceId });
  const membership = await getWorkspaceMembership(input.workspaceId, userId);
  if (!membership) {
    throw new Error("Workspace membership not found.");
  }
  if (membership.role === "owner") {
    throw new Error("Workspace owners cannot leave. Delete the workspace instead.");
  }

  const { data, error } = await client
    .from("workspace_members")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Leave workspace failed: ${error.message}`);
  if (!data) throw new Error("Workspace membership not found.");

  await notifyMemberLeft(client, { workspaceId: input.workspaceId, memberUserId: userId });
}

export async function removeWorkspaceMember(workspaceId: string, memberUserId: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceMemberRemoveSchema.parse({ workspaceId, memberUserId });
  assertWorkspaceMutable(input.workspaceId);
  if (input.memberUserId === userId) {
    throw new Error("Use Leave workspace to remove your own membership.");
  }

  const [membership, member] = await Promise.all([
    getWorkspaceMembership(input.workspaceId, userId),
    getWorkspaceMembership(input.workspaceId, input.memberUserId),
  ]);
  if (!membership || !member || !canRemoveWorkspaceMember(membership.role, member.role)) {
    throw new Error("You cannot remove this workspace member.");
  }

  const { data, error } = await client
    .from("workspace_members")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.memberUserId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Remove workspace member failed: ${error.message}`);
  if (!data) throw new Error("Workspace membership not found.");

  await notifyMemberRemoved(client, {
    workspaceId: input.workspaceId,
    removedUserId: input.memberUserId,
    actorUserId: userId,
  });
}

export async function updateWorkspaceMemberRole(workspaceId: string, memberUserId: string, role: "requester" | "admin", userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceMemberRoleUpdateSchema.parse({ workspaceId, memberUserId, role });
  assertWorkspaceMutable(input.workspaceId);
  if (input.memberUserId === userId) {
    throw new Error("You cannot change your own workspace role.");
  }

  const [membership, member] = await Promise.all([
    getWorkspaceMembership(input.workspaceId, userId),
    getWorkspaceMembership(input.workspaceId, input.memberUserId),
  ]);
  if (membership?.role !== "owner" || !member || member.role === "owner") {
    throw new Error("Workspace owner access is required.");
  }

  const { data, error } = await client
    .from("workspace_members")
    .update({ role: input.role })
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.memberUserId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Update workspace member failed: ${error.message}`);
  if (!data) throw new Error("Workspace membership not found.");

  await notifyMemberRoleChanged(client, {
    workspaceId: input.workspaceId,
    memberUserId: input.memberUserId,
    newRole: input.role,
    actorUserId: userId,
  });
}

export async function deleteWorkspace(workspaceId: string, confirmation: string, userId: string) {
  const client = requireSupabaseAdminClient();
  const input = workspaceDeleteSchema.parse({ workspaceId, confirmation });
  assertWorkspaceMutable(input.workspaceId);
  const workspace = await getWorkspaceById(input.workspaceId);
  if (!workspace) throw new Error("Workspace not found.");
  if (input.confirmation !== workspace.slug) {
    throw new PublicError(`Enter ${workspace.slug} to confirm permanent deletion.`);
  }

  const membership = await getWorkspaceMembership(input.workspaceId, userId);
  if (membership?.role !== "owner") {
    throw new Error("Workspace owner access is required.");
  }

  const { data: attachments, error: attachmentError } = await client
    .from("request_attachments")
    .select("storage_path")
    .eq("workspace_id", input.workspaceId);
  if (attachmentError) throw new Error(`List workspace attachments failed: ${attachmentError.message}`);

  const storagePaths = ((attachments ?? []) as SupabaseRow[]).map((row) => asString(row.storage_path)).filter(Boolean);
  if (storagePaths.length > 0) {
    const bucket = process.env.SUPABASE_REQUEST_ATTACHMENTS_BUCKET || process.env.SUPABASE_REQUEST_IMAGES_BUCKET || "request-attachments";
    const { error } = await client.storage.from(bucket).remove(storagePaths);
    if (error) throw new Error(`Delete workspace attachments failed: ${error.message}`);
  }

  const { error } = await client.rpc("delete_workspace_as_owner", {
    target_workspace_id: input.workspaceId,
    target_user_id: userId,
  });
  if (error) throw new Error(error.message || "Delete workspace failed.");
}

export function getPostAuthWorkspacePath() {
  return "/onboarding";
}

export function workspaceInviteLink(workspaceSlug: string, code: string) {
  return `/join/${workspaceSlug}?code=${encodeURIComponent(code)}`;
}

export async function requireWorkspaceMembership(workspaceSlug: string, userId: string) {
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) throw new Error("Workspace not found.");

  const membership = await getWorkspaceMembership(workspace.id, userId);
  if (!membership) throw new Error("Workspace access is required.");

  return { workspace, membership };
}

export function isWorkspaceAdmin(role: UserRole) {
  return role === "admin" || role === "owner";
}

export function canCreateWorkspaceInvite(actorRole: UserRole, inviteRole: AssignableUserRole) {
  return actorRole === "owner" || (actorRole === "admin" && inviteRole === "requester");
}

// Owners can revoke/delete any invite in the workspace; admins can only manage the
// invites they created themselves (so the 5-invite cap can't wedge them). Requesters
// can never manage invites.
export function canManageWorkspaceInvite(actorRole: UserRole, actorId: string, invite: WorkspaceInviteRecord) {
  if (actorRole === "owner") return true;
  return actorRole === "admin" && Boolean(invite.createdBy) && invite.createdBy === actorId;
}

export function canRemoveWorkspaceMember(actorRole: UserRole, memberRole: UserRole) {
  return actorRole === "owner" || (actorRole === "admin" && memberRole === "requester");
}
