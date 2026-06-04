import { requireSupabaseAdminClient } from "@/lib/supabase";
import { workspaceInviteCodeSchema, type AssignableUserRole, type UserRole, type WorkspaceInviteRecord, type WorkspaceMemberRecord, type WorkspaceRecord } from "@/lib/schema";

export const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_WORKSPACE_SLUG = "demo-school";
export const DEMO_WORKSPACE_INVITE_CODE = "DEMO-SCHOOL-2026";

type SupabaseRow = Record<string, unknown>;

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

export function normalizeWorkspaceInviteCode(code: string) {
  return workspaceInviteCodeSchema.parse(code).toUpperCase();
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

export function isWorkspaceInviteActive(invite: WorkspaceInviteRecord, at = new Date()) {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= at.getTime()) return false;
  return invite.isReusable || !invite.usedAt;
}

export async function requireActiveWorkspaceInvite(workspaceId: string, code: string) {
  const invite = await getWorkspaceInviteByCode(workspaceId, code);
  if (!invite || !isWorkspaceInviteActive(invite)) {
    throw new Error("Workspace invite is invalid or expired.");
  }
  return invite;
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
