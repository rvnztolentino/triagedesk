import { z } from "zod";

export const priorities = ["low", "medium", "high", "critical"] as const;
export const departments = ["it", "maintenance", "admin", "security", "clinic", "facilities"] as const;
export const requestStatuses = ["needs-review", "approved", "rejected", "duplicate"] as const;
export const ticketStatuses = ["new", "needs-review", "open", "in-progress", "resolved", "closed"] as const;
export const triageSources = ["rules", "groq"] as const;
export const userRoles = ["requester", "admin"] as const;

export const prioritySchema = z.enum(priorities);
export const departmentSchema = z.enum(departments);
export const requestStatusSchema = z.enum(requestStatuses);
export const ticketStatusSchema = z.enum(ticketStatuses);
export const triageSourceSchema = z.enum(triageSources);
export const userRoleSchema = z.enum(userRoles);

export const requestSubmissionSchema = z.object({
  description: z.string().trim().min(10, "Describe the issue in at least 10 characters."),
  location: z.string().trim().min(2, "Location is required."),
  contactName: z.string().trim().default(""),
  urgencyNote: z.string().trim().default(""),
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
  title: z.string().trim().min(3),
  priority: prioritySchema,
  department: departmentSchema,
  summary: z.string().trim().min(10),
});

export const ticketUpdateSchema = z.object({
  ticketId: z.string().min(1),
  status: ticketStatusSchema,
  department: departmentSchema,
  resolutionNotes: z.string().trim().default(""),
  note: z.string().trim().default(""),
});

export const authCredentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
  displayName: z.string().trim().max(80).default(""),
});

export const loginCredentialsSchema = authCredentialsSchema.omit({ displayName: true });

export const userRoleUpdateSchema = z.object({
  userId: z.string().uuid(),
  role: userRoleSchema,
});

export type Priority = z.infer<typeof prioritySchema>;
export type Department = z.infer<typeof departmentSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TriageSource = z.infer<typeof triageSourceSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
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
  requesterUserId?: string;
  status: RequestStatus;
  imageUrl?: string;
  duplicateOfTicketId?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface TriageResultRecord extends TriageDraft {
  id: string;
  requestId: string;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
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
  ticketId?: string;
  requestId?: string;
  action: string;
  actor: string;
  details: string;
  createdAt: string;
}

export interface TicketNoteRecord {
  id: string;
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
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}
