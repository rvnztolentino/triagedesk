import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRuntimeSetupStatus,
  getSupabaseAdminClient,
  requireSupabaseAdminClient,
} from "@/lib/supabase";
import {
  defaultDepartmentIds,
  workspaceDepartmentCreateSchema,
  workspaceDepartmentDeleteSchema,
  type Department,
  type DepartmentRecord,
  type AppUser,
  type Priority,
  type RequestAttachmentRecord,
  type RequestRecord,
  type RequestSubmission,
  type SimilarTicket,
  type TicketActivityRecord,
  type TicketNoteRecord,
  type TicketRecord,
  type TicketStatus,
  type TriageDraft,
  type TriageResultRecord,
} from "@/lib/schema";
import { assertWorkspaceMutable, DEMO_WORKSPACE_ID } from "@/lib/workspaces";

export interface ReviewItem {
  request: RequestRecord;
  triage: TriageResultRecord;
  similarTickets: SimilarTicket[];
  attachments: RequestAttachmentRecord[];
}

export interface DashboardData {
  setupRequired?: string[];
  counts: {
    newRequests: number;
    openTickets: number;
    highPriority: number;
    assigned: number;
    resolved: number;
    averageResolutionHours: number;
    slaRisk: number;
    agingTickets: number;
  };
  priorityDistribution: { priority: Priority; count: number }[];
  departmentWorkload: { department: Department; count: number }[];
  resolutionTrend: { label: string; resolved: number }[];
  recentActivity: TicketActivityRecord[];
  featuredReview?: ReviewItem;
}

type SupabaseRow = Record<string, unknown>;
type SupabaseError = { message: string } | null;
type SeedRecord<T extends { workspaceId: string }> = Omit<T, "workspaceId">;

const defaultDepartments: DepartmentRecord[] = [
  { id: "it", name: "IT", description: "Network, devices, software, projectors, printers, accounts." },
  { id: "facilities", name: "Facilities", description: "General building operations and space coordination." },
  { id: "maintenance", name: "Maintenance", description: "HVAC, leaks, electrical, plumbing, repairs." },
  { id: "security", name: "Security", description: "Access control, doors, gates, badges, incidents." },
  { id: "admin", name: "Admin", description: "Admin records, scheduling, office supplies, front desk operations." },
  { id: "clinic", name: "Clinic / Health", description: "Patient areas, health concerns, medical rooms, clinical workflow support." },
];

const seededRequests: SeedRecord<RequestRecord>[] = [
  {
    id: "REQ-1001",
    description: "There is a significant water leak coming from the ceiling near the back emergency exit. Water is pooling on the floor.",
    location: "Outpatient Wing, Main Corridor",
    contactName: "Sarah Jenkins",
    urgencyNote: "Morning patient intake starts in 2 hours.",
    status: "needs-review",
    createdAt: "2026-05-24T05:10:00.000Z",
  },
  {
    id: "REQ-1002",
    description: "The pediatric wing waiting area is very warm. Thermostat says 78 degrees and patients are complaining.",
    location: "Clinic Wing C",
    contactName: "Dr. Emily Ross",
    urgencyNote: "Patients are complaining.",
    status: "needs-review",
    createdAt: "2026-05-24T05:20:00.000Z",
  },
  {
    id: "REQ-1003",
    description: "Aircon in Recovery Room 304 is leaking again. Floor is wet near the outlet.",
    location: "Recovery Wing, Room 304",
    contactName: "Nurse Station",
    urgencyNote: "Wet floor near patients and staff.",
    status: "needs-review",
    duplicateOfTicketId: "TRG-1038",
    createdAt: "2026-05-24T05:30:00.000Z",
  },
  {
    id: "REQ-1004",
    description: "Someone reported smoke smell near the server closet and the network rack fans are loud.",
    location: "Admin Block, Server Closet",
    contactName: "Front Desk",
    urgencyNote: "Possible electrical issue.",
    status: "needs-review",
    createdAt: "2026-05-24T05:42:00.000Z",
  },
  {
    id: "REQ-1005",
    description: "The copy room is out of clinic intake forms and letter paper.",
    location: "Building 2, Copy Room 2A",
    contactName: "Admin Assistant",
    urgencyNote: "",
    status: "rejected",
    reviewedAt: "2026-05-24T04:00:00.000Z",
    createdAt: "2026-05-24T03:40:00.000Z",
  },
];

const seededTriageResults: SeedRecord<TriageResultRecord>[] = [
  {
    id: "TRI-1001",
    requestId: "REQ-1001",
    source: "groq",
    title: "Water leak at Outpatient Wing, Main Corridor",
    category: "Maintenance",
    priority: "critical",
    department: "maintenance",
    summary: "Maintenance should dispatch immediately to the outpatient corridor. Water is pooling near an emergency exit before morning patient intake.",
    priorityReasoning: "Pooling water creates slip risk, potential property damage, and direct disruption to patient intake.",
    similarTicketIds: ["TRG-1038"],
    createdAt: "2026-05-24T05:11:00.000Z",
  },
  {
    id: "TRI-1002",
    requestId: "REQ-1002",
    source: "groq",
    title: "HVAC issue at Clinic Wing C",
    category: "Maintenance",
    priority: "high",
    department: "maintenance",
    summary: "Maintenance should inspect Clinic Wing C. The waiting area is too warm for patient comfort.",
    priorityReasoning: "Patient-facing spaces need faster response because comfort and care operations are affected.",
    similarTicketIds: ["TRG-1048"],
    createdAt: "2026-05-24T05:21:00.000Z",
  },
  {
    id: "TRI-1003",
    requestId: "REQ-1003",
    source: "groq",
    title: "HVAC issue at Recovery Wing, Room 304",
    category: "Maintenance",
    priority: "high",
    department: "maintenance",
    summary: "Maintenance should inspect Recovery Room 304 because the AC leak is recurring and creating a wet floor hazard.",
    priorityReasoning: "Recurring leak and wet flooring create a safety risk for patients and staff.",
    similarTicketIds: ["TRG-1038"],
    createdAt: "2026-05-24T05:31:00.000Z",
  },
  {
    id: "TRI-1004",
    requestId: "REQ-1004",
    source: "groq",
    title: "Possible electrical issue at Admin Block, Server Closet",
    category: "IT",
    priority: "critical",
    department: "it",
    summary: "IT should inspect the server closet immediately and coordinate with Maintenance if electrical risk is confirmed.",
    priorityReasoning: "Smoke smell near network equipment can indicate electrical risk and possible service outage.",
    similarTicketIds: ["TRG-1047"],
    createdAt: "2026-05-24T05:43:00.000Z",
  },
];

const seededTickets: SeedRecord<TicketRecord>[] = [
  {
    id: "TRG-1043",
    title: "Telehealth display unavailable",
    description: "The telehealth display in Consultation Room B is showing a hardware error and the image is very dim.",
    location: "Outpatient Wing, Consultation Room B",
    contactName: "Mark Chen",
    urgencyNote: "Remote consultation at 3 PM.",
    status: "open",
    priority: "medium",
    department: "it",
    category: "IT",
    triageSummary: "Routine telehealth display inspection. Assign to IT before the afternoon consultation.",
    priorityReasoning: "Consultation room equipment is impaired but does not block core operations yet.",
    resolutionNotes: "",
    createdAt: "2026-05-23T14:30:00.000Z",
    updatedAt: "2026-05-23T15:00:00.000Z",
  },
  {
    id: "TRG-1044",
    title: "Keycard access denied at East Gate",
    description: "Several employees report their badges are flashing red at the East Gate turnstiles.",
    location: "East Gate Entrance",
    contactName: "Security Desk",
    urgencyNote: "Creating a backup at the entrance.",
    status: "in-progress",
    priority: "high",
    department: "security",
    category: "Security",
    triageSummary: "Multiple access failures at a primary entry point. Likely authentication sync issue.",
    priorityReasoning: "The issue affects multiple users and creates a physical security bottleneck.",
    resolutionNotes: "",
    createdAt: "2026-05-24T04:45:00.000Z",
    updatedAt: "2026-05-24T04:55:00.000Z",
  },
  {
    id: "TRG-1047",
    title: "Network outage in admin wing",
    description: "The admin wing lost Wi-Fi and wired network access for front desk machines.",
    location: "Admin Block",
    contactName: "Office Manager",
    urgencyNote: "Check-in desk cannot print visitor badges.",
    status: "in-progress",
    priority: "critical",
    department: "it",
    category: "IT",
    triageSummary: "IT should restore admin network access and verify switch health.",
    priorityReasoning: "Front desk operations and visitor access are blocked.",
    resolutionNotes: "",
    createdAt: "2026-05-24T02:35:00.000Z",
    updatedAt: "2026-05-24T03:15:00.000Z",
  },
  {
    id: "TRG-1048",
    title: "Warm air in clinic waiting area",
    description: "Clinic waiting area AC is blowing warm air during afternoon intake.",
    location: "Clinic Wing C",
    contactName: "Nurse Station",
    urgencyNote: "Patients waiting with children.",
    status: "open",
    priority: "high",
    department: "maintenance",
    category: "Maintenance",
    triageSummary: "HVAC issue in patient-facing area requires prompt maintenance inspection.",
    priorityReasoning: "Patient comfort and clinical operations are affected.",
    resolutionNotes: "",
    createdAt: "2026-05-23T22:15:00.000Z",
    updatedAt: "2026-05-23T22:25:00.000Z",
  },
  {
    id: "TRG-1030",
    title: "Restock copy paper",
    description: "The copy room on the 2nd floor is completely out of letter-sized paper.",
    location: "Building 2, Copy Room 2A",
    contactName: "Admin Assistant",
    urgencyNote: "",
    status: "resolved",
    priority: "low",
    department: "admin",
    category: "Admin",
    triageSummary: "Standard supply request.",
    priorityReasoning: "Routine request with no immediate operational threat.",
    resolutionNotes: "Restocked 10 reams of letter paper and added a reorder marker.",
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T10:15:00.000Z",
    resolvedAt: "2026-05-22T10:15:00.000Z",
  },
  {
    id: "TRG-1038",
    title: "AC drain leak near Recovery Room 304",
    description: "AC drain line leaked near Recovery Room 304 and made the tile slippery.",
    location: "Recovery Wing, Room 304",
    contactName: "Facilities Desk",
    urgencyNote: "",
    status: "closed",
    priority: "high",
    department: "maintenance",
    category: "Maintenance",
    triageSummary: "HVAC drain issue created a slip hazard.",
    priorityReasoning: "Wet flooring can create safety risk.",
    resolutionNotes: "Drain line cleared and floor dried. Monitor for recurrence.",
    createdAt: "2026-05-20T02:00:00.000Z",
    updatedAt: "2026-05-20T06:00:00.000Z",
    resolvedAt: "2026-05-20T05:30:00.000Z",
    closedAt: "2026-05-20T06:00:00.000Z",
  },
];

const seededActivity: SeedRecord<TicketActivityRecord>[] = [
  { id: "ACT-1001", ticketId: "TRG-1047", action: "Ticket approved", actor: "Admin", details: "Approved as critical IT incident.", createdAt: "2026-05-24T02:40:00.000Z" },
  { id: "ACT-1002", ticketId: "TRG-1047", action: "Status changed", actor: "IT Lead", details: "Moved to in progress; checking switch uplink.", createdAt: "2026-05-24T03:15:00.000Z" },
  { id: "ACT-1003", ticketId: "TRG-1044", action: "Ticket approved", actor: "System", details: "Assigned to Security.", createdAt: "2026-05-24T04:50:00.000Z" },
  { id: "ACT-1004", ticketId: "TRG-1044", action: "Status changed", actor: "Security Desk", details: "Badge sync check started.", createdAt: "2026-05-24T04:55:00.000Z" },
  { id: "ACT-1005", requestId: "REQ-1001", action: "AI triage completed", actor: "System", details: "Critical maintenance request with patient intake impact.", createdAt: "2026-05-24T05:11:00.000Z" },
  { id: "ACT-1006", requestId: "REQ-1002", action: "AI triage completed", actor: "System", details: "High-priority clinic HVAC request.", createdAt: "2026-05-24T05:21:00.000Z" },
  { id: "ACT-1007", requestId: "REQ-1003", action: "AI triage completed", actor: "System", details: "Similar Room 304 AC drain leak found.", createdAt: "2026-05-24T05:31:00.000Z" },
  { id: "ACT-1008", requestId: "REQ-1004", action: "AI triage completed", actor: "System", details: "Critical IT request with electrical risk language.", createdAt: "2026-05-24T05:43:00.000Z" },
  { id: "ACT-1009", ticketId: "TRG-1030", action: "Resolved", actor: "Admin", details: "Supplies restocked.", createdAt: "2026-05-22T10:15:00.000Z" },
  { id: "ACT-1010", ticketId: "TRG-1038", action: "Closed", actor: "Maintenance", details: "Drain line cleared and monitored.", createdAt: "2026-05-20T06:00:00.000Z" },
  { id: "ACT-1011", ticketId: "TRG-1048", action: "Assigned", actor: "Maintenance Lead", details: "HVAC technician assigned for clinic waiting area inspection.", createdAt: "2026-05-24T05:50:00.000Z" },
  { id: "ACT-1012", ticketId: "TRG-1043", action: "Note added", actor: "IT Support", details: "Replacement telehealth display cable pulled from storage.", createdAt: "2026-05-24T06:05:00.000Z" },
  { id: "ACT-1013", ticketId: "TRG-1044", action: "Vendor contacted", actor: "Security Desk", details: "Access controller vendor asked to review East Gate sync logs.", createdAt: "2026-05-24T06:18:00.000Z" },
  { id: "ACT-1014", ticketId: "TRG-1047", action: "Escalated", actor: "IT Lead", details: "Network outage escalated to infrastructure team.", createdAt: "2026-05-24T06:32:00.000Z" },
  { id: "ACT-1015", requestId: "REQ-1002", action: "Review pending", actor: "Admin", details: "Clinic HVAC request kept in review for technician availability.", createdAt: "2026-05-24T06:45:00.000Z" },
  { id: "ACT-1016", ticketId: "TRG-1048", action: "Status changed", actor: "Maintenance Lead", details: "Clinic waiting area ticket moved to in progress.", createdAt: "2026-05-24T07:00:00.000Z" },
  { id: "ACT-1017", ticketId: "TRG-1043", action: "Scheduled", actor: "IT Support", details: "Telehealth display inspection scheduled before remote consultation.", createdAt: "2026-05-24T07:15:00.000Z" },
  { id: "ACT-1018", requestId: "REQ-1004", action: "Safety check requested", actor: "Admin", details: "Maintenance asked to inspect outlet and smoke smell near server closet.", createdAt: "2026-05-24T07:28:00.000Z" },
  { id: "ACT-1019", ticketId: "TRG-1044", action: "Controller restarted", actor: "Security Desk", details: "East Gate controller restart completed; monitoring badge scans.", createdAt: "2026-05-24T07:42:00.000Z" },
  { id: "ACT-1020", ticketId: "TRG-1047", action: "Service restored", actor: "IT Lead", details: "Admin wing wired network restored after uplink replacement.", createdAt: "2026-05-24T07:55:00.000Z" },
];

const seededNotes: SeedRecord<TicketNoteRecord>[] = [
  {
    id: "NOTE-1001",
    ticketId: "TRG-1047",
    actor: "IT Lead",
    body: "Switch uplink is flapping; replacing patch cable before escalating to ISP.",
    createdAt: "2026-05-24T03:20:00.000Z",
  },
  {
    id: "NOTE-1002",
    ticketId: "TRG-1044",
    actor: "Security Desk",
    body: "Badge failures are isolated to the east gate controller.",
    createdAt: "2026-05-24T05:05:00.000Z",
  },
];

function now() {
  return new Date().toISOString();
}

function withDemoWorkspace<T extends object>(record: T) {
  return { ...record, workspaceId: DEMO_WORKSPACE_ID };
}

function requireNoError(error: SupabaseError, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asDepartment(value: unknown): Department {
  return asString(value) as Department;
}

function asPriority(value: unknown): Priority {
  return asString(value) as Priority;
}

function asTicketStatus(value: unknown): TicketStatus {
  return asString(value) as TicketStatus;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
}

function requestToRow(request: RequestRecord) {
  return {
    id: request.id,
    workspace_id: request.workspaceId,
    requester_user_id: request.requesterUserId ?? null,
    description: request.description,
    location: request.location,
    contact_name: request.contactName,
    urgency_note: request.urgencyNote,
    image_url: request.imageUrl ?? null,
    status: request.status,
    duplicate_of_ticket_id: request.duplicateOfTicketId ?? null,
    created_at: request.createdAt,
    reviewed_at: request.reviewedAt ?? null,
  };
}

function requestFromRow(row: SupabaseRow): RequestRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    requesterUserId: row.requester_user_id ? asString(row.requester_user_id) : undefined,
    description: asString(row.description),
    location: asString(row.location),
    contactName: asString(row.contact_name),
    urgencyNote: asString(row.urgency_note),
    status: asString(row.status) as RequestRecord["status"],
    imageUrl: row.image_url ? asString(row.image_url) : undefined,
    duplicateOfTicketId: row.duplicate_of_ticket_id ? asString(row.duplicate_of_ticket_id) : undefined,
    createdAt: asString(row.created_at),
    reviewedAt: row.reviewed_at ? asString(row.reviewed_at) : undefined,
  };
}

function triageToRow(triage: TriageResultRecord) {
  return {
    id: triage.id,
    workspace_id: triage.workspaceId,
    request_id: triage.requestId,
    source: triage.source,
    title: triage.title,
    category: triage.category,
    priority: triage.priority,
    department: triage.department,
    summary: triage.summary,
    priority_reasoning: triage.priorityReasoning,
    similar_ticket_ids: triage.similarTicketIds,
    created_at: triage.createdAt,
  };
}

function triageFromRow(row: SupabaseRow): TriageResultRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    requestId: asString(row.request_id),
    source: asString(row.source) as TriageResultRecord["source"],
    title: asString(row.title),
    category: asString(row.category),
    priority: asPriority(row.priority),
    department: asDepartment(row.department),
    summary: asString(row.summary),
    priorityReasoning: asString(row.priority_reasoning),
    similarTicketIds: asStringArray(row.similar_ticket_ids),
    createdAt: asString(row.created_at),
  };
}

function ticketToRow(ticket: TicketRecord) {
  return {
    id: ticket.id,
    workspace_id: ticket.workspaceId,
    request_id: ticket.requestId ?? null,
    requester_user_id: ticket.requesterUserId ?? null,
    title: ticket.title,
    description: ticket.description,
    location: ticket.location,
    contact_name: ticket.contactName,
    urgency_note: ticket.urgencyNote,
    status: ticket.status,
    priority: ticket.priority,
    department: ticket.department,
    category: ticket.category,
    triage_summary: ticket.triageSummary,
    priority_reasoning: ticket.priorityReasoning,
    resolution_notes: ticket.resolutionNotes,
    duplicate_of_ticket_id: ticket.duplicateOfTicketId ?? null,
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
    resolved_at: ticket.resolvedAt ?? null,
    closed_at: ticket.closedAt ?? null,
  };
}

function ticketFromRow(row: SupabaseRow): TicketRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    requestId: row.request_id ? asString(row.request_id) : undefined,
    requesterUserId: row.requester_user_id ? asString(row.requester_user_id) : undefined,
    title: asString(row.title),
    description: asString(row.description),
    location: asString(row.location),
    contactName: asString(row.contact_name),
    urgencyNote: asString(row.urgency_note),
    status: asTicketStatus(row.status),
    priority: asPriority(row.priority),
    department: asDepartment(row.department),
    category: asString(row.category),
    triageSummary: asString(row.triage_summary),
    priorityReasoning: asString(row.priority_reasoning),
    resolutionNotes: asString(row.resolution_notes),
    duplicateOfTicketId: row.duplicate_of_ticket_id ? asString(row.duplicate_of_ticket_id) : undefined,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    resolvedAt: row.resolved_at ? asString(row.resolved_at) : undefined,
    closedAt: row.closed_at ? asString(row.closed_at) : undefined,
  };
}

function activityToRow(activity: TicketActivityRecord) {
  return {
    id: activity.id,
    workspace_id: activity.workspaceId,
    ticket_id: activity.ticketId ?? null,
    request_id: activity.requestId ?? null,
    action: activity.action,
    actor: activity.actor,
    details: activity.details,
    created_at: activity.createdAt,
  };
}

function productActivityText(value: string) {
  return value
    .replace(/\bGroq triage completed\b/g, "AI triage completed")
    .replace(/\bRequest submitted\b/g, "Request saved")
    .replace(/\bGroq\b/g, "AI")
    .replace(/\bSupabase\b/g, "workspace");
}

function activityFromRow(row: SupabaseRow): TicketActivityRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    ticketId: row.ticket_id ? asString(row.ticket_id) : undefined,
    requestId: row.request_id ? asString(row.request_id) : undefined,
    action: productActivityText(asString(row.action)),
    actor: asString(row.actor),
    details: productActivityText(asString(row.details)),
    createdAt: asString(row.created_at),
  };
}

function noteToRow(note: TicketNoteRecord) {
  return {
    id: note.id,
    workspace_id: note.workspaceId,
    ticket_id: note.ticketId,
    actor: note.actor,
    body: note.body,
    created_at: note.createdAt,
  };
}

function noteFromRow(row: SupabaseRow): TicketNoteRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    ticketId: asString(row.ticket_id),
    actor: asString(row.actor),
    body: asString(row.body),
    createdAt: asString(row.created_at),
  };
}

function attachmentFromRow(row: SupabaseRow): RequestAttachmentRecord {
  return {
    id: asString(row.id),
    workspaceId: asString(row.workspace_id),
    requestId: asString(row.request_id),
    fileName: asString(row.file_name) || asString(row.storage_path).split("/").pop() || "Attachment",
    storagePath: asString(row.storage_path),
    publicUrl: row.public_url ? asString(row.public_url) : undefined,
    contentType: asString(row.content_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: asString(row.created_at),
  };
}

function emptyDashboardData(): DashboardData {
  const status = getRuntimeSetupStatus();

  return {
    setupRequired: status.missing,
    counts: {
      newRequests: 0,
      openTickets: 0,
      highPriority: 0,
      assigned: 0,
      resolved: 0,
      averageResolutionHours: 0,
      slaRisk: 0,
      agingTickets: 0,
    },
    priorityDistribution: countByPriority([]),
    departmentWorkload: countByDepartment([]),
    resolutionTrend: buildResolutionTrend([]),
    recentActivity: [],
  };
}

async function clearWorkspaceTable(client: SupabaseClient, table: string, workspaceId: string) {
  const { error } = await client.from(table).delete().eq("workspace_id", workspaceId);
  requireNoError(error, `Clear ${table}`);
}

async function insertRows(client: SupabaseClient, table: string, rows: SupabaseRow[]) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).insert(rows);
  requireNoError(error, `Insert ${table}`);
}

async function nextNumericId(client: SupabaseClient, table: string, column: string, prefix: string) {
  const { data, error } = await client.from(table).select(column).like(column, `${prefix}-%`);
  requireNoError(error, `Generate ${prefix} id`);

  const max = ((data ?? []) as unknown as SupabaseRow[]).reduce((highest, row) => {
    const value = asString(row[column]);
    const numeric = Number(value.replace(`${prefix}-`, ""));
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 999);

  return `${prefix}-${Math.max(1000, max + 1)}`;
}

async function addActivity(
  client: SupabaseClient,
  input: Omit<TicketActivityRecord, "id" | "createdAt"> & { createdAt?: string }
) {
  const activity: TicketActivityRecord = {
    id: await nextNumericId(client, "ticket_activity", "id", "ACT"),
    createdAt: input.createdAt ?? now(),
    ...input,
  };

  const { error } = await client.from("ticket_activity").insert(activityToRow(activity));
  requireNoError(error, "Insert ticket activity");
  return activity;
}

async function fetchTicketRows(client: SupabaseClient, statusFilter?: string, requesterUserId?: string, workspaceId = DEMO_WORKSPACE_ID) {
  let query = client.from("tickets").select("*").eq("workspace_id", workspaceId);

  if (requesterUserId) {
    query = query.eq("requester_user_id", requesterUserId);
  }

  if (statusFilter === "active") {
    query = query.in("status", ["new", "needs-review", "open", "in-progress"]);
  } else if (statusFilter === "resolved") {
    query = query.in("status", ["resolved", "closed"]);
  } else if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  requireNoError(error, "List tickets");
  return ((data ?? []) as SupabaseRow[]).map(ticketFromRow);
}

async function getLatestTriage(client: SupabaseClient, requestId: string, workspaceId = DEMO_WORKSPACE_ID) {
  const { data, error } = await client
    .from("ai_triage_results")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  requireNoError(error, "Get triage result");
  return data ? triageFromRow(data as SupabaseRow) : undefined;
}

async function requireWorkspaceRequest(client: SupabaseClient, requestId: string, workspaceId: string) {
  const { data, error } = await client
    .from("requests")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();
  requireNoError(error, "Get workspace request");
  if (!data) throw new Error("Request not found.");
}

async function requireWorkspaceTicket(client: SupabaseClient, ticketId: string, workspaceId: string) {
  const { data, error } = await client
    .from("tickets")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", ticketId)
    .maybeSingle();
  requireNoError(error, "Get workspace ticket");
  if (!data) throw new Error("Ticket not found.");
}

async function listRequestAttachmentsFromClient(client: SupabaseClient, requestId: string, workspaceId: string) {
  const { data, error } = await client
    .from("request_attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  requireNoError(error, "List request attachments");
  return ((data ?? []) as SupabaseRow[]).map(attachmentFromRow);
}

async function getLatestNeedsReview(client: SupabaseClient, workspaceId = DEMO_WORKSPACE_ID): Promise<ReviewItem | undefined> {
  const { data, error } = await client
    .from("requests")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "needs-review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  requireNoError(error, "Get latest review item");

  if (!data) return undefined;

  const request = requestFromRow(data as SupabaseRow);
  const triage = await getLatestTriage(client, request.id, workspaceId);
  if (!triage) return undefined;

  return {
    request,
    triage,
    similarTickets: await getSimilarTicketsFromClient(client, `${request.description} ${request.location}`, request.id, triage.department, workspaceId),
    attachments: await listRequestAttachmentsFromClient(client, request.id, workspaceId),
  };
}

export async function resetWorkspaceData(workspaceId = DEMO_WORKSPACE_ID) {
  const client = requireSupabaseAdminClient();

  if (workspaceId !== DEMO_WORKSPACE_ID) {
    throw new Error("Only the seeded demo workspace can be reset.");
  }

  await clearWorkspaceTable(client, "ticket_notes", workspaceId);
  await clearWorkspaceTable(client, "ticket_activity", workspaceId);
  await clearWorkspaceTable(client, "tickets", workspaceId);
  await clearWorkspaceTable(client, "ai_triage_results", workspaceId);
  await clearWorkspaceTable(client, "request_attachments", workspaceId);
  await clearWorkspaceTable(client, "requests", workspaceId);
  await clearWorkspaceTable(client, "workspace_metadata", workspaceId);
  await clearWorkspaceTable(client, "departments", workspaceId);

  await insertRows(client, "departments", defaultDepartments.map((department) => ({
    workspace_id: workspaceId,
    id: department.id,
    name: department.name,
    description: department.description,
  })));
  await insertRows(client, "requests", seededRequests.map(withDemoWorkspace).map(requestToRow));
  await insertRows(client, "ai_triage_results", seededTriageResults.map(withDemoWorkspace).map(triageToRow));
  await insertRows(client, "tickets", seededTickets.map(withDemoWorkspace).map(ticketToRow));
  await insertRows(client, "ticket_activity", seededActivity.map(withDemoWorkspace).map(activityToRow));
  await insertRows(client, "ticket_notes", seededNotes.map(withDemoWorkspace).map(noteToRow));
  await insertRows(client, "workspace_metadata", [
    { workspace_id: workspaceId, key: "seeded", value: "triagedesk-demo-clinic-seed-v4" },
    { workspace_id: workspaceId, key: "seeded_at", value: now() },
  ]);

  return { ok: true };
}

export async function listDepartments(workspaceId = DEMO_WORKSPACE_ID) {
  const client = getSupabaseAdminClient();
  if (!client) return defaultDepartments;

  let { data, error } = await client
    .from("departments")
    .select("id, name, description")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error?.message.includes("departments.workspace_id")) {
    const fallback = await client.from("departments").select("id, name, description").order("name");
    data = fallback.data;
    error = fallback.error;
  }

  requireNoError(error, "List departments");

  const departments = ((data ?? []) as SupabaseRow[]).map((row) => ({
    id: asDepartment(row.id),
    name: asString(row.name),
    description: asString(row.description),
  }));

  return departments.length > 0 ? departments : defaultDepartments;
}

export async function createWorkspaceDepartment(input: unknown, actorRole: "admin" | "owner" | "requester") {
  const parsed = workspaceDepartmentCreateSchema.parse(input);
  assertWorkspaceMutable(parsed.workspaceId);
  if (actorRole !== "admin" && actorRole !== "owner") {
    throw new Error("Workspace admin access is required.");
  }

  const client = requireSupabaseAdminClient();
  const { error } = await client.from("departments").insert({
    workspace_id: parsed.workspaceId,
    id: parsed.id,
    name: parsed.name,
    description: parsed.description,
  });
  requireNoError(error, "Create department");
}

export async function deleteWorkspaceDepartment(input: unknown, actorRole: "admin" | "owner" | "requester") {
  const parsed = workspaceDepartmentDeleteSchema.parse(input);
  assertWorkspaceMutable(parsed.workspaceId);
  if (actorRole !== "admin" && actorRole !== "owner") {
    throw new Error("Workspace admin access is required.");
  }
  if ((defaultDepartmentIds as readonly string[]).includes(parsed.id)) {
    throw new Error("Default departments cannot be removed.");
  }

  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("departments")
    .delete()
    .eq("workspace_id", parsed.workspaceId)
    .eq("id", parsed.id)
    .select("id")
    .maybeSingle();
  requireNoError(error, "Delete department");
  if (!data) throw new Error("Department not found.");
}

export async function createRequest(input: RequestSubmission, requester: AppUser, workspaceId = DEMO_WORKSPACE_ID) {
  assertWorkspaceMutable(workspaceId);
  const client = requireSupabaseAdminClient();
  const timestamp = now();
  const request: RequestRecord = {
    id: await nextNumericId(client, "requests", "id", "REQ"),
    workspaceId,
    requesterUserId: requester.id,
    ...input,
    contactName: input.contactName || requester.displayName,
    status: "needs-review",
    createdAt: timestamp,
  };

  const { error } = await client.from("requests").insert(requestToRow(request));
  requireNoError(error, "Create request");

  await addActivity(client, {
    workspaceId,
    requestId: request.id,
    action: "Request saved",
    actor: requester.displayName,
    details: `${request.location}: ${request.description}`,
    createdAt: timestamp,
  });

  return request;
}

export async function createRequestAttachment(
  requestId: string,
  input: Pick<RequestAttachmentRecord, "fileName" | "storagePath" | "publicUrl" | "contentType" | "sizeBytes">,
  workspaceId = DEMO_WORKSPACE_ID
) {
  assertWorkspaceMutable(workspaceId);
  const client = requireSupabaseAdminClient();
  await requireWorkspaceRequest(client, requestId, workspaceId);
  const attachment: RequestAttachmentRecord = {
    id: crypto.randomUUID(),
    workspaceId,
    requestId,
    ...input,
    createdAt: now(),
  };
  const { error } = await client.from("request_attachments").insert({
    id: attachment.id,
    workspace_id: attachment.workspaceId,
    request_id: attachment.requestId,
    file_name: attachment.fileName,
    storage_path: attachment.storagePath,
    public_url: attachment.publicUrl ?? null,
    content_type: attachment.contentType,
    size_bytes: attachment.sizeBytes,
    created_at: attachment.createdAt,
  });
  requireNoError(error, "Save request attachment");
  return attachment;
}

export async function saveTriageResult(requestId: string, triage: TriageDraft, workspaceId = DEMO_WORKSPACE_ID) {
  assertWorkspaceMutable(workspaceId);
  const client = requireSupabaseAdminClient();
  await requireWorkspaceRequest(client, requestId, workspaceId);
  const record: TriageResultRecord = {
    id: await nextNumericId(client, "ai_triage_results", "id", "TRI"),
    workspaceId,
    requestId,
    ...triage,
    createdAt: now(),
  };

  const { error } = await client.from("ai_triage_results").insert(triageToRow(record));
  requireNoError(error, "Save triage result");

  await addActivity(client, {
    workspaceId,
    requestId,
    action: "AI triage completed",
    actor: "System",
    details: `${record.priority.toUpperCase()} ${record.category} request assigned to ${record.department}.`,
    createdAt: record.createdAt,
  });

  return record;
}

export async function listReviewItems(workspaceId = DEMO_WORKSPACE_ID): Promise<ReviewItem[]> {
  const client = getSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from("requests")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "needs-review")
    .order("created_at", { ascending: false });
  requireNoError(error, "List review items");

  const requests = ((data ?? []) as SupabaseRow[]).map(requestFromRow);
  const items = await Promise.all(
    requests.map(async (request) => {
      const triage = await getLatestTriage(client, request.id, workspaceId);
      if (!triage) return undefined;
      return {
        request,
        triage,
        similarTickets: await getSimilarTicketsFromClient(client, `${request.description} ${request.location}`, request.id, triage.department, workspaceId),
        attachments: await listRequestAttachmentsFromClient(client, request.id, workspaceId),
      };
    })
  );

  return items.filter((item): item is ReviewItem => Boolean(item));
}

export async function getRequestBundle(requestId: string, requesterUserId?: string, workspaceId = DEMO_WORKSPACE_ID): Promise<ReviewItem | undefined> {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  let query = client.from("requests").select("*").eq("workspace_id", workspaceId).eq("id", requestId);
  if (requesterUserId) {
    query = query.eq("requester_user_id", requesterUserId);
  }
  const { data, error } = await query.maybeSingle();
  requireNoError(error, "Get request");

  if (!data) return undefined;

  const request = requestFromRow(data as SupabaseRow);
  const triage = await getLatestTriage(client, request.id, workspaceId);
  if (!triage) return undefined;

  return {
    request,
    triage,
    similarTickets: await getSimilarTicketsFromClient(client, `${request.description} ${request.location}`, request.id, triage.department, workspaceId),
    attachments: await listRequestAttachmentsFromClient(client, request.id, workspaceId),
  };
}

export async function getVisibleRequestAttachment(attachmentId: string, requesterUserId: string | undefined, workspaceId = DEMO_WORKSPACE_ID) {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  const { data, error } = await client
    .from("request_attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", attachmentId)
    .maybeSingle();
  requireNoError(error, "Get request attachment");
  if (!data) return undefined;

  const attachment = attachmentFromRow(data as SupabaseRow);
  if (requesterUserId) {
    const { data: requestData, error: requestError } = await client
      .from("requests")
      .select("requester_user_id")
      .eq("workspace_id", workspaceId)
      .eq("id", attachment.requestId)
      .maybeSingle();
    requireNoError(requestError, "Get attachment request");
    if (!requestData || asString((requestData as SupabaseRow).requester_user_id) !== requesterUserId) return undefined;
  }

  return attachment;
}

export async function getLatestRequestBundle(requesterUserId?: string, workspaceId = DEMO_WORKSPACE_ID) {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  let query = client.from("requests").select("id").eq("workspace_id", workspaceId);
  if (requesterUserId) {
    query = query.eq("requester_user_id", requesterUserId);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  requireNoError(error, "Get latest request");

  return data ? getRequestBundle(asString((data as SupabaseRow).id), requesterUserId, workspaceId) : undefined;
}

export async function listTickets(statusFilter?: string, requesterUserId?: string, workspaceId = DEMO_WORKSPACE_ID) {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  return fetchTicketRows(client, statusFilter, requesterUserId, workspaceId);
}

export async function getTicketDetail(ticketId: string, requesterUserId?: string, workspaceId = DEMO_WORKSPACE_ID) {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  let query = client.from("tickets").select("*").eq("workspace_id", workspaceId).eq("id", ticketId);
  if (requesterUserId) {
    query = query.eq("requester_user_id", requesterUserId);
  }
  const { data, error } = await query.maybeSingle();
  requireNoError(error, "Get ticket");
  if (!data) return undefined;

  const ticket = ticketFromRow(data as SupabaseRow);
  const [{ data: activityData, error: activityError }, { data: notesData, error: notesError }] = await Promise.all([
    client.from("ticket_activity").select("*").eq("workspace_id", workspaceId).eq("ticket_id", ticket.id).order("created_at", { ascending: false }),
    client.from("ticket_notes").select("*").eq("workspace_id", workspaceId).eq("ticket_id", ticket.id).order("created_at", { ascending: false }),
  ]);
  requireNoError(activityError, "Get ticket activity");
  requireNoError(notesError, "Get ticket notes");

  return {
    ticket,
    activity: ((activityData ?? []) as SupabaseRow[]).map(activityFromRow),
    notes: ((notesData ?? []) as SupabaseRow[]).map(noteFromRow),
    similarTickets: await getSimilarTicketsFromClient(client, `${ticket.title} ${ticket.description} ${ticket.location}`, ticket.id, ticket.department, workspaceId),
  };
}

export async function getSimilarTickets(text: string, department?: Department, workspaceId = DEMO_WORKSPACE_ID) {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  return getSimilarTicketsFromClient(client, text, undefined, department, workspaceId);
}

export async function findReusableTriageDraft(input: RequestSubmission, workspaceId = DEMO_WORKSPACE_ID): Promise<TriageDraft | undefined> {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  const { data, error } = await client
    .from("requests")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("description", input.description)
    .eq("location", input.location)
    .eq("urgency_note", input.urgencyNote)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  requireNoError(error, "Find reusable triage");

  if (!data) return undefined;

  const triage = await getLatestTriage(client, asString((data as SupabaseRow).id), workspaceId);
  if (!triage) return undefined;

  return {
    source: triage.source,
    title: triage.title,
    category: triage.category,
    priority: triage.priority,
    department: triage.department,
    summary: triage.summary,
    priorityReasoning: triage.priorityReasoning,
    similarTicketIds: triage.similarTicketIds,
  };
}

export async function approveRequest(input: {
  requestId: string;
  title: string;
  priority: Priority;
  department: Department;
  summary: string;
}, workspaceId = DEMO_WORKSPACE_ID) {
  assertWorkspaceMutable(workspaceId);
  const client = requireSupabaseAdminClient();

  const { data: requestData, error: requestError } = await client
    .from("requests")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", input.requestId)
    .maybeSingle();
  requireNoError(requestError, "Get request for approval");

  const triage = await getLatestTriage(client, input.requestId, workspaceId);
  if (!requestData || !triage) throw new Error("Request not found.");

  const { data: existingData, error: existingError } = await client
    .from("tickets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("request_id", input.requestId)
    .maybeSingle();
  requireNoError(existingError, "Check existing ticket");
  if (existingData) return ticketFromRow(existingData as SupabaseRow);

  const request = requestFromRow(requestData as SupabaseRow);
  const timestamp = now();
  const ticket: TicketRecord = {
    id: await nextNumericId(client, "tickets", "id", "TRG"),
    workspaceId,
    requestId: request.id,
    requesterUserId: request.requesterUserId,
    title: input.title,
    description: request.description,
    location: request.location,
    contactName: request.contactName,
    urgencyNote: request.urgencyNote,
    status: "new",
    priority: input.priority,
    department: input.department,
    category: triage.category,
    triageSummary: input.summary,
    priorityReasoning: triage.priorityReasoning,
    resolutionNotes: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const { data: updatedRequest, error: updateError } = await client
    .from("requests")
    .update({ status: "approved", reviewed_at: timestamp })
    .eq("workspace_id", workspaceId)
    .eq("id", request.id)
    .select("id")
    .maybeSingle();
  requireNoError(updateError, "Approve request");
  if (!updatedRequest) throw new Error("Request not found.");

  const { error: insertError } = await client.from("tickets").insert(ticketToRow(ticket));
  if (insertError) {
    // A concurrent approval may have created the ticket between our existence
    // check and this insert. The unique index on (workspace_id, request_id)
    // turns that race into a 23505; treat it as idempotent by returning the
    // ticket the winning request already created.
    if ((insertError as { code?: string }).code === "23505") {
      const { data: racedData, error: racedError } = await client
        .from("tickets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("request_id", request.id)
        .maybeSingle();
      requireNoError(racedError, "Load concurrently created ticket");
      if (racedData) return ticketFromRow(racedData as SupabaseRow);
    }
    requireNoError(insertError, "Create ticket");
  }

  await addActivity(client, {
    workspaceId,
    ticketId: ticket.id,
    requestId: request.id,
    action: "Ticket approved",
    actor: "Admin",
    details: `Approved as ${ticket.priority} priority for ${ticket.department}.`,
    createdAt: timestamp,
  });

  return ticket;
}

export async function rejectRequest(requestId: string, workspaceId = DEMO_WORKSPACE_ID) {
  assertWorkspaceMutable(workspaceId);
  const client = requireSupabaseAdminClient();
  const timestamp = now();

  const { data, error } = await client
    .from("requests")
    .update({ status: "rejected", reviewed_at: timestamp })
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .select("id")
    .maybeSingle();
  requireNoError(error, "Reject request");
  if (!data) throw new Error("Request not found.");

  await addActivity(client, {
    workspaceId,
    requestId,
    action: "Request rejected",
    actor: "Admin",
    details: "Request rejected during human review.",
    createdAt: timestamp,
  });
}

export async function markDuplicate(requestId: string, duplicateOfTicketId: string, workspaceId = DEMO_WORKSPACE_ID) {
  assertWorkspaceMutable(workspaceId);
  const client = requireSupabaseAdminClient();
  const timestamp = now();
  await requireWorkspaceTicket(client, duplicateOfTicketId, workspaceId);

  const { data, error } = await client
    .from("requests")
    .update({ status: "duplicate", duplicate_of_ticket_id: duplicateOfTicketId, reviewed_at: timestamp })
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .select("id")
    .maybeSingle();
  requireNoError(error, "Mark request duplicate");
  if (!data) throw new Error("Request not found.");

  await addActivity(client, {
    workspaceId,
    requestId,
    action: "Marked duplicate",
    actor: "Admin",
    details: `Marked as duplicate of ${duplicateOfTicketId}.`,
    createdAt: timestamp,
  });
}

export async function updateTicket(input: {
  ticketId: string;
  status: TicketStatus;
  department: Department;
  resolutionNotes: string;
  note: string;
}, workspaceId = DEMO_WORKSPACE_ID) {
  assertWorkspaceMutable(workspaceId);
  const client = requireSupabaseAdminClient();
  const { data, error } = await client.from("tickets").select("*").eq("workspace_id", workspaceId).eq("id", input.ticketId).maybeSingle();
  requireNoError(error, "Get ticket for update");
  if (!data) throw new Error("Ticket not found.");

  const ticket = ticketFromRow(data as SupabaseRow);
  const timestamp = now();
  const changes: string[] = [];
  let resolvedAt = ticket.resolvedAt ?? null;
  let closedAt = ticket.closedAt ?? null;

  if (ticket.status !== input.status) {
    changes.push(`Status changed from ${ticket.status} to ${input.status}.`);
    if (input.status === "resolved" && !resolvedAt) resolvedAt = timestamp;
    if (input.status === "closed" && !closedAt) closedAt = timestamp;
  }

  if (ticket.department !== input.department) {
    changes.push(`Department changed from ${ticket.department} to ${input.department}.`);
  }

  if (ticket.resolutionNotes !== input.resolutionNotes) {
    changes.push("Resolution notes updated.");
  }

  if (input.note) {
    changes.push(input.note);
    const note: TicketNoteRecord = {
      id: await nextNumericId(client, "ticket_notes", "id", "NOTE"),
      workspaceId,
      ticketId: ticket.id,
      actor: "Admin",
      body: input.note,
      createdAt: timestamp,
    };
    const { error: noteError } = await client.from("ticket_notes").insert(noteToRow(note));
    requireNoError(noteError, "Add ticket note");
  }

  const { data: updatedData, error: updateError } = await client
    .from("tickets")
    .update({
      status: input.status,
      department: input.department,
      resolution_notes: input.resolutionNotes,
      updated_at: timestamp,
      resolved_at: resolvedAt,
      closed_at: closedAt,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", ticket.id)
    .select("*")
    .maybeSingle();
  requireNoError(updateError, "Update ticket");
  if (!updatedData) throw new Error("Ticket not found.");

  if (changes.length > 0) {
    await addActivity(client, {
      workspaceId,
      ticketId: ticket.id,
      requestId: ticket.requestId,
      action: "Ticket updated",
      actor: "Admin",
      details: changes.join(" "),
      createdAt: timestamp,
    });
  }

  return ticketFromRow(updatedData as SupabaseRow);
}

export async function getDashboardData(workspaceId = DEMO_WORKSPACE_ID): Promise<DashboardData> {
  const client = getSupabaseAdminClient();
  if (!client) return emptyDashboardData();

  const [tickets, reviewItem, activityResult, requestsResult] = await Promise.all([
    fetchTicketRows(client, "all", undefined, workspaceId),
    getLatestNeedsReview(client, workspaceId),
    client.from("ticket_activity").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(20),
    client.from("requests").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
  ]);
  requireNoError(activityResult.error, "List recent activity");
  requireNoError(requestsResult.error, "List requests");

  const requests = ((requestsResult.data ?? []) as SupabaseRow[]).map(requestFromRow);
  const activeTickets = tickets.filter((ticket) => ["new", "needs-review", "open", "in-progress"].includes(ticket.status));
  const resolvedTickets = tickets.filter((ticket) => ticket.resolvedAt);
  const totalResolutionMs = resolvedTickets.reduce((sum, ticket) => {
    return sum + (new Date(ticket.resolvedAt || ticket.updatedAt).getTime() - new Date(ticket.createdAt).getTime());
  }, 0);
  const averageResolutionHours = resolvedTickets.length ? totalResolutionMs / resolvedTickets.length / 1000 / 60 / 60 : 0;

  return {
    counts: {
      newRequests: requests.filter((request) => request.status === "needs-review").length,
      openTickets: activeTickets.length,
      highPriority: activeTickets.filter((ticket) => ["high", "critical"].includes(ticket.priority)).length,
      assigned: activeTickets.filter((ticket) => ticket.status === "in-progress").length,
      resolved: tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length,
      averageResolutionHours,
      slaRisk: activeTickets.filter((ticket) => ticket.priority === "critical" || (ticket.priority === "high" && ticket.status !== "in-progress")).length,
      agingTickets: activeTickets.filter((ticket) => Date.now() - new Date(ticket.createdAt).getTime() > 1000 * 60 * 60 * 12).length,
    },
    priorityDistribution: countByPriority(activeTickets),
    departmentWorkload: countByDepartment(activeTickets),
    resolutionTrend: buildResolutionTrend(tickets),
    recentActivity: ((activityResult.data ?? []) as SupabaseRow[]).map(activityFromRow),
    featuredReview: reviewItem,
  };
}

function countByPriority(tickets: TicketRecord[]) {
  return (["critical", "high", "medium", "low"] as Priority[]).map((priority) => ({
    priority,
    count: tickets.filter((ticket) => ticket.priority === priority).length,
  }));
}

function countByDepartment(tickets: TicketRecord[]) {
  const ids = new Set<Department>(defaultDepartments.map((department) => department.id));
  for (const ticket of tickets) {
    ids.add(ticket.department);
  }

  return [...ids].map((department) => ({
    department,
    count: tickets.filter((ticket) => ticket.department === department).length,
  }));
}

function buildResolutionTrend(tickets: TicketRecord[]) {
  const days = ["May 20", "May 21", "May 22", "May 23", "May 24"];
  return days.map((label) => ({
    label,
    resolved: tickets.filter((ticket) => {
      const date = ticket.resolvedAt ?? ticket.closedAt;
      return date ? new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) === label : false;
    }).length,
  }));
}

async function getSimilarTicketsFromClient(
  client: SupabaseClient,
  text: string,
  excludeId?: string,
  preferredDepartment?: Department,
  workspaceId = DEMO_WORKSPACE_ID
): Promise<SimilarTicket[]> {
  const tokens = new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
  const tickets = await fetchTicketRows(client, "all", undefined, workspaceId);

  return tickets
    .filter((ticket) => ticket.id !== excludeId && ticket.requestId !== excludeId)
    .map((ticket) => {
      const haystack = `${ticket.title} ${ticket.description} ${ticket.location} ${ticket.category}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 1;
      }
      if (preferredDepartment && ticket.department === preferredDepartment) score += 2;
      return { ticket, score };
    })
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ ticket }) => ({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      department: ticket.department,
      reason: ticket.department === preferredDepartment ? "Same department with matching request terms." : "Matching location, category, or issue terms.",
    }));
}
