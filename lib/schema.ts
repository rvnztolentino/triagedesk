import { z } from "zod";
import { toTitleCase } from "@/lib/format";
import { containsProfanity } from "@/lib/display-name";

export const priorities = ["low", "medium", "high", "critical"] as const;
export const defaultDepartmentIds = ["it", "facilities", "maintenance", "security", "admin", "clinic"] as const;
export const requestStatuses = ["needs-review", "approved", "rejected", "duplicate"] as const;
export const ticketStatuses = ["new", "open", "in-progress", "resolved", "closed"] as const;
export const triageSources = ["rules", "groq"] as const;
export const userRoles = ["requester", "admin", "owner"] as const;
export const assignableUserRoles = ["requester", "admin"] as const;
export const notificationTypes = [
  "request_submitted",
  "request_approved",
  "request_rejected",
  "request_duplicate",
  "ticket_status_changed",
  "member_joined",
  "member_left",
  "member_removed",
  "member_role_changed",
] as const;

export const prioritySchema = z.enum(priorities);
export const departmentSchema = z.string().trim().min(1);
export const requestStatusSchema = z.enum(requestStatuses);
export const ticketStatusSchema = z.enum(ticketStatuses);
export const triageSourceSchema = z.enum(triageSources);
export const userRoleSchema = z.enum(userRoles);
export const assignableUserRoleSchema = z.enum(assignableUserRoles);

export const requestSubmissionSchema = z.object({
  description: z.string().trim().min(10, "Describe the issue in at least 10 characters.").max(1200, "Keep the description under 1,200 characters."),
  location: z.string().trim().min(2, "Location is required.").max(160, "Keep the location under 160 characters.").transform(toTitleCase),
  contactName: z.string().trim().max(80, "Keep the contact name under 80 characters.").default("").transform(toTitleCase),
  urgencyNote: z.string().trim().max(400, "Keep the urgency note under 400 characters.").default(""),
});

export const triageDraftSchema = z.object({
  source: triageSourceSchema,
  title: z.string().trim().min(3),
  category: z.string().trim().min(2),
  priority: prioritySchema,
  department: departmentSchema,
  summary: z.string().trim().min(10),
  priorityReasoning: z.string().trim().min(10),
  similarTicketIds: z.array(z.string()).default([]),
});

export const reviewApprovalSchema = z.object({
  requestId: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  priority: prioritySchema,
  department: departmentSchema,
  summary: z.string().trim().min(10).max(1200),
  note: z.string().trim().max(2000).default(""),
});

export const ticketUpdateSchema = z.object({
  ticketId: z.string().min(1),
  status: ticketStatusSchema,
  department: departmentSchema,
  resolutionNotes: z.string().trim().max(4000).default(""),
  note: z.string().trim().max(2000).default(""),
});

export const authCredentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
  displayName: z.string().trim().max(80).default(""),
});

export const loginCredentialsSchema = authCredentialsSchema.omit({ displayName: true });

export const userRoleUpdateSchema = z.object({
  userId: z.string().uuid(),
  role: assignableUserRoleSchema,
});

export const workspaceSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export const workspaceInviteCodeSchema = z
  .string()
  .trim()
  .min(6)
  .max(80)
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, "Use letters, numbers, and single hyphens.");

export const workspaceInviteInputSchema = z.string().trim().min(6).max(500);

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Workspace name is required.")
  .max(80)
  .refine((value) => !containsProfanity(value), "Choose a different workspace name.");

export const workspaceCreateSchema = z.object({
  name: workspaceNameSchema,
});

export const workspaceJoinSchema = z.object({
  workspaceSlug: workspaceSlugSchema,
  code: workspaceInviteInputSchema,
});

export const workspaceInviteCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  role: assignableUserRoleSchema,
});

export const workspaceInviteRevokeSchema = z.object({
  workspaceId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

export const workspaceMemberLeaveSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const workspaceMemberRemoveSchema = z.object({
  workspaceId: z.string().uuid(),
  memberUserId: z.string().uuid(),
});

export const workspaceMemberRoleUpdateSchema = z.object({
  workspaceId: z.string().uuid(),
  memberUserId: z.string().uuid(),
  role: assignableUserRoleSchema,
});

export const workspaceDeleteSchema = z.object({
  workspaceId: z.string().uuid(),
  confirmation: workspaceSlugSchema,
});

export const departmentIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export const workspaceDepartmentCreateSchema = z.object({
  workspaceId: z.string().uuid(),
  id: departmentIdSchema,
  name: z.string().trim().min(2, "Department name is required.").max(80),
  description: z.string().trim().max(200).default(""),
});

export const workspaceDepartmentDeleteSchema = z.object({
  workspaceId: z.string().uuid(),
  id: departmentIdSchema,
});

export type Priority = z.infer<typeof prioritySchema>;
export type Department = z.infer<typeof departmentSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TriageSource = z.infer<typeof triageSourceSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type AssignableUserRole = z.infer<typeof assignableUserRoleSchema>;
export type NotificationType = (typeof notificationTypes)[number];
export type RequestSubmission = z.infer<typeof requestSubmissionSchema>;
export type TriageDraft = z.infer<typeof triageDraftSchema>;
export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export interface DepartmentRecord {
  id: Department;
  name: string;
  description: string;
}

export interface RequestRecord extends RequestSubmission {
  id: string;
  workspaceId: string;
  requesterUserId?: string;
  status: RequestStatus;
  imageUrl?: string;
  duplicateOfTicketId?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface TriageResultRecord extends TriageDraft {
  id: string;
  workspaceId: string;
  requestId: string;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  workspaceId: string;
  requestId?: string;
  requesterUserId?: string;
  title: string;
  description: string;
  location: string;
  contactName: string;
  urgencyNote: string;
  status: TicketStatus;
  priority: Priority;
  department: Department;
  category: string;
  triageSummary: string;
  priorityReasoning: string;
  resolutionNotes: string;
  duplicateOfTicketId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface TicketActivityRecord {
  id: string;
  workspaceId: string;
  ticketId?: string;
  requestId?: string;
  action: string;
  actor: string;
  details: string;
  createdAt: string;
}

export interface TicketNoteRecord {
  id: string;
  workspaceId: string;
  ticketId: string;
  actor: string;
  body: string;
  createdAt: string;
}

export interface SimilarTicket {
  id: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  department: Department;
  reason: string;
}

export interface UserProfileRecord {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  // Display-name change throttling window (see lib/display-name.ts). Optional so
  // rows written before the migration and the AppUser projection stay valid.
  nameChangeCount?: number;
  nameChangeWindowStart?: string;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  createdBy?: string;
  createdAt: string;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: UserRole;
  createdAt: string;
}

export interface WorkspaceMemberSummary extends WorkspaceMemberRecord {
  email: string;
  displayName: string;
}

export interface WorkspaceInviteRecord {
  id: string;
  workspaceId: string;
  code: string;
  role: AssignableUserRole;
  createdBy?: string;
  expiresAt?: string;
  usedAt?: string;
  revokedAt?: string;
  isReusable: boolean;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  actor: string;
  readAt?: string;
  createdAt: string;
}

// Serializable shape passed to client components (bell + notifications page).
export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  actor: string;
  read: boolean;
  createdAt: string;
}

export interface RequestAttachmentRecord {
  id: string;
  workspaceId: string;
  requestId: string;
  fileName: string;
  storagePath: string;
  publicUrl?: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
