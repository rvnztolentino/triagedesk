import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { captureOperationalError } from "@/lib/monitoring";
import type {
  NotificationType,
  NotificationView,
  RequestStatus,
  TicketStatus,
  UserRole,
} from "@/lib/schema";

type SupabaseRow = Record<string, unknown>;

// Cap the number of rows the bell hydrates on each page load. The full history
// lives on the dedicated notifications page.
export const NOTIFICATION_PREVIEW_LIMIT = 15;

interface NotificationInput {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  actor?: string;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function statusLabel(status: string) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function notificationToView(row: SupabaseRow): NotificationView {
  return {
    id: asString(row.id),
    type: asString(row.type) as NotificationType,
    title: asString(row.title),
    body: asString(row.body),
    link: row.link ? asString(row.link) : undefined,
    actor: asString(row.actor),
    read: Boolean(row.read_at),
    createdAt: asString(row.created_at),
  };
}

// Notifications are best-effort: a delivery failure must never break the
// operational mutation that triggered it. Failures are reported, then swallowed.
async function insertNotifications(client: SupabaseClient, inputs: NotificationInput[]) {
  if (inputs.length === 0) return;

  try {
    const rows = inputs.map((input) => ({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      link: input.link ?? null,
      actor: input.actor ?? "",
    }));
    const { error } = await client.from("notifications").insert(rows);
    if (error) throw new Error(error.message);
  } catch (error) {
    captureOperationalError(error, { area: "notifications_insert" });
  }
}

// Resolve the user IDs of workspace members holding any of the given roles,
// optionally excluding one user (e.g. the actor who triggered the event).
async function getWorkspaceMemberUserIds(
  client: SupabaseClient,
  workspaceId: string,
  roles: UserRole[],
  excludeUserId?: string
): Promise<string[]> {
  const { data, error } = await client
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .in("role", roles);
  if (error) {
    captureOperationalError(new Error(error.message), { area: "notifications_members" });
    return [];
  }

  return ((data ?? []) as SupabaseRow[])
    .map((row) => asString(row.user_id))
    .filter((id) => id && id !== excludeUserId);
}

export async function getUserDisplayName(client: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await client
    .from("user_profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return "A member";
  const row = data as SupabaseRow;
  return asString(row.display_name) || asString(row.email) || "A member";
}

// ── Reads (bell + notifications page) ──────────────────────────────────────

export async function listNotifications(
  userId: string,
  workspaceId: string,
  limit = NOTIFICATION_PREVIEW_LIMIT
): Promise<NotificationView[]> {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    captureOperationalError(new Error(error.message), { area: "notifications_list" });
    return [];
  }

  return ((data ?? []) as SupabaseRow[]).map(notificationToView);
}

export async function countUnreadNotifications(userId: string, workspaceId: string): Promise<number> {
  const client = getSupabaseAdminClient();
  if (!client) return 0;

  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .is("read_at", null);
  if (error) {
    captureOperationalError(new Error(error.message), { area: "notifications_unread_count" });
    return 0;
  }

  return count ?? 0;
}

// Deletes every notification for the user in the workspace (the "Clear all" action).
export async function clearNotifications(userId: string, workspaceId: string) {
  const client = getSupabaseAdminClient();
  if (!client) return;

  const { error } = await client
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (error) {
    captureOperationalError(new Error(error.message), { area: "notifications_clear" });
  }
}

export async function markAllNotificationsRead(userId: string, workspaceId: string) {
  const client = getSupabaseAdminClient();
  if (!client) return;

  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .is("read_at", null);
  if (error) {
    captureOperationalError(new Error(error.message), { area: "notifications_mark_read" });
  }
}

// ── Event emitters (called from domain mutations) ──────────────────────────

// A new request entered the review queue → notify admins and owners.
export async function notifyRequestSubmitted(
  client: SupabaseClient,
  input: { workspaceId: string; requestId: string; requesterName: string; requesterUserId?: string }
) {
  const recipients = await getWorkspaceMemberUserIds(
    client,
    input.workspaceId,
    ["admin", "owner"],
    input.requesterUserId
  );
  await insertNotifications(
    client,
    recipients.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      type: "request_submitted" as const,
      title: "New request needs review",
      body: `${input.requesterName} submitted ${input.requestId}.`,
      link: `/review/${input.requestId}`,
      actor: input.requesterName,
    }))
  );
}

// A request was approved / rejected / marked duplicate → notify its requester.
export async function notifyRequestDecision(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    requestId: string;
    requesterUserId?: string;
    decision: Extract<RequestStatus, "approved" | "rejected" | "duplicate">;
    actorName: string;
    actorUserId?: string;
    ticketId?: string;
  }
) {
  if (!input.requesterUserId || input.requesterUserId === input.actorUserId) return;

  const config = {
    approved: {
      type: "request_approved" as const,
      title: "Your request was approved",
      body: input.ticketId
        ? `${input.requestId} was approved and became ticket ${input.ticketId}.`
        : `${input.requestId} was approved.`,
      link: input.ticketId ? `/tickets/${input.ticketId}` : `/requests/${input.requestId}`,
    },
    rejected: {
      type: "request_rejected" as const,
      title: "Your request was rejected",
      body: `${input.requestId} was rejected during review.`,
      link: `/requests/${input.requestId}`,
    },
    duplicate: {
      type: "request_duplicate" as const,
      title: "Your request was marked a duplicate",
      body: `${input.requestId} was marked as a duplicate.`,
      link: `/requests/${input.requestId}`,
    },
  }[input.decision];

  await insertNotifications(client, [
    {
      workspaceId: input.workspaceId,
      userId: input.requesterUserId,
      type: config.type,
      title: config.title,
      body: config.body,
      link: config.link,
      actor: input.actorName,
    },
  ]);
}

// A ticket's status changed → notify the requester who owns it.
export async function notifyTicketStatusChanged(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    ticketId: string;
    requesterUserId?: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    actorName: string;
    actorUserId?: string;
  }
) {
  if (!input.requesterUserId || input.requesterUserId === input.actorUserId) return;

  await insertNotifications(client, [
    {
      workspaceId: input.workspaceId,
      userId: input.requesterUserId,
      type: "ticket_status_changed",
      title: `Ticket ${input.ticketId} moved to ${statusLabel(input.toStatus)}`,
      body: `Status changed from ${statusLabel(input.fromStatus)} to ${statusLabel(input.toStatus)}.`,
      link: `/tickets/${input.ticketId}`,
      actor: input.actorName,
    },
  ]);
}

// A ticket was assigned → notify the new assignee, unless they assigned it themselves.
export async function notifyTicketAssigned(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    ticketId: string;
    ticketTitle: string;
    assigneeUserId: string;
    actorName: string;
    actorUserId?: string;
  }
) {
  if (input.assigneeUserId === input.actorUserId) return;

  await insertNotifications(client, [
    {
      workspaceId: input.workspaceId,
      userId: input.assigneeUserId,
      type: "ticket_assigned",
      title: `Ticket ${input.ticketId} was assigned to you`,
      body: input.ticketTitle,
      link: `/tickets/${input.ticketId}`,
      actor: input.actorName,
    },
  ]);
}

// A member joined the workspace → notify owners.
export async function notifyMemberJoined(
  client: SupabaseClient,
  input: { workspaceId: string; memberUserId: string }
) {
  const [memberName, owners] = await Promise.all([
    getUserDisplayName(client, input.memberUserId),
    getWorkspaceMemberUserIds(client, input.workspaceId, ["owner"], input.memberUserId),
  ]);
  await insertNotifications(
    client,
    owners.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      type: "member_joined" as const,
      title: "A new member joined",
      body: `${memberName} joined the workspace.`,
      link: "/users",
      actor: memberName,
    }))
  );
}

// A member left the workspace → notify owners.
export async function notifyMemberLeft(
  client: SupabaseClient,
  input: { workspaceId: string; memberUserId: string }
) {
  const [memberName, owners] = await Promise.all([
    getUserDisplayName(client, input.memberUserId),
    getWorkspaceMemberUserIds(client, input.workspaceId, ["owner"], input.memberUserId),
  ]);
  await insertNotifications(
    client,
    owners.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      type: "member_left" as const,
      title: "A member left",
      body: `${memberName} left the workspace.`,
      link: "/users",
      actor: memberName,
    }))
  );
}

// A member was removed → notify remaining owners (the removed member loses access).
export async function notifyMemberRemoved(
  client: SupabaseClient,
  input: { workspaceId: string; removedUserId: string; actorUserId?: string }
) {
  const [removedName, actorName, owners] = await Promise.all([
    getUserDisplayName(client, input.removedUserId),
    input.actorUserId ? getUserDisplayName(client, input.actorUserId) : Promise.resolve("An admin"),
    getWorkspaceMemberUserIds(client, input.workspaceId, ["owner"], input.removedUserId),
  ]);
  await insertNotifications(
    client,
    owners.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      type: "member_removed" as const,
      title: "A member was removed",
      body: `${actorName} removed ${removedName} from the workspace.`,
      link: "/users",
      actor: actorName,
    }))
  );
}

// A member's role changed → notify owners plus the affected member.
export async function notifyMemberRoleChanged(
  client: SupabaseClient,
  input: { workspaceId: string; memberUserId: string; newRole: UserRole; actorUserId?: string }
) {
  const [memberName, actorName, owners] = await Promise.all([
    getUserDisplayName(client, input.memberUserId),
    input.actorUserId ? getUserDisplayName(client, input.actorUserId) : Promise.resolve("An owner"),
    getWorkspaceMemberUserIds(client, input.workspaceId, ["owner"], input.actorUserId),
  ]);
  const roleName = statusLabel(input.newRole);

  const recipients = new Map<string, NotificationInput>();
  for (const userId of owners) {
    recipients.set(userId, {
      workspaceId: input.workspaceId,
      userId,
      type: "member_role_changed",
      title: "A member's role changed",
      body: `${actorName} changed ${memberName}'s role to ${roleName}.`,
      link: "/users",
      actor: actorName,
    });
  }
  // The affected member always hears about their own role change.
  recipients.set(input.memberUserId, {
    workspaceId: input.workspaceId,
    userId: input.memberUserId,
    type: "member_role_changed",
    title: "Your role changed",
    body: `${actorName} changed your role to ${roleName}.`,
    link: "/tickets",
    actor: actorName,
  });

  await insertNotifications(client, [...recipients.values()]);
}
