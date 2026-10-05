import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";

interface Call {
  table: string;
  op: "select" | "insert" | "update";
  payload?: unknown;
  filters: Record<string, unknown>;
  single: boolean;
}

// Every from() call is recorded with its final operation, payload, and eq filters, so
// a test can assert both what was written and how it was scoped.
const calls: Call[] = [];
let ticketRow: Record<string, unknown>;
let memberRow: Record<string, unknown> | null;
let ticketsError: { message: string } | null;
// Rows a bulk ticket update reports back, for the unassign-on-departure path.
let affectedTickets: Record<string, unknown>[];

function from(table: string) {
  const call: Call = { table, op: "select", filters: {}, single: false };
  calls.push(call);
  const result = () => {
    if (table === "tickets") {
      if (ticketsError) return { data: null, error: ticketsError };
      if (!call.single) return { data: affectedTickets, error: null };
      // Approval first asks whether the request already has a ticket. It does not.
      if (call.op === "select" && "request_id" in call.filters) return { data: null, error: null };
      return { data: call.op === "update" ? { ...ticketRow, ...(call.payload as object) } : ticketRow, error: null };
    }
    if (table === "workspace_members") return { data: memberRow, error: null };
    if (table === "workspaces") return { data: { is_demo: false }, error: null };
    if (table === "user_profiles") return { data: { display_name: "Ana Reyes", email: "ana@example.com" }, error: null };
    if (table === "requests") return { data: requestRow, error: null };
    if (table === "ai_triage_results") return { data: triageRow, error: null };
    return { data: null, error: null };
  };
  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    eq: (column: string, value: unknown) => {
      call.filters[column] = value;
      return chain;
    },
    insert: (payload: unknown) => {
      call.op = "insert";
      call.payload = payload;
      return chain;
    },
    update: (payload: unknown) => {
      call.op = "update";
      call.payload = payload;
      return chain;
    },
    maybeSingle: () => {
      call.single = true;
      return Promise.resolve(result());
    },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
  };
  return chain;
}

const client = { from, rpc: vi.fn().mockResolvedValue({ data: "ACT-2001", error: null }) };
const captureOperationalError = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: () => client,
  requireSupabaseAdminClient: () => client,
  getRuntimeSetupStatus: () => ({ missing: [] }),
  requestAttachmentBucket: () => "request-attachments",
}));
vi.mock("@/lib/monitoring", () => ({ captureOperationalError: (...args: unknown[]) => captureOperationalError(...args) }));

const requestRow = {
  id: "REQ-1001",
  workspace_id: WORKSPACE_ID,
  requester_user_id: null,
  description: "The printer shows offline.",
  location: "Front desk",
  contact_name: "",
  urgency_note: "",
  status: "needs-review",
  created_at: "2026-06-01T07:55:00.000Z",
};
const triageRow = {
  id: "TRI-1001",
  workspace_id: WORKSPACE_ID,
  request_id: "REQ-1001",
  source: "rules",
  title: "Front desk printer offline",
  category: "Hardware",
  priority: "medium",
  department: "it",
  summary: "Printer offline at the front desk.",
  priority_reasoning: "Blocks visitor check-in.",
  similar_ticket_ids: [],
  created_at: "2026-06-01T07:56:00.000Z",
};
const approval = { requestId: "REQ-1001", title: "Front desk printer offline", priority: "high" as const, department: "it", summary: "Printer offline at the front desk." };
const owner = { id: OWNER_ID, name: "Olivia Owner" };

const update = { ticketId: "TRG-1001", status: "open" as const, priority: "high" as const, department: "it", resolutionNotes: "", note: "" };

function callsTo(table: string, op: Call["op"]) {
  return calls.filter((call) => call.table === table && call.op === op);
}

beforeEach(() => {
  calls.length = 0;
  captureOperationalError.mockClear();
  ticketsError = null;
  affectedTickets = [];
  ticketRow = {
    id: "TRG-1001",
    workspace_id: WORKSPACE_ID,
    requester_user_id: null,
    assignee_user_id: null,
    title: "Front desk printer offline",
    description: "The printer shows offline.",
    location: "Front desk",
    status: "open",
    priority: "high",
    department: "it",
    category: "Hardware",
    triage_summary: "Printer offline at the front desk.",
    priority_reasoning: "Blocks visitor check-in.",
    resolution_notes: "",
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-01T08:00:00.000Z",
  };
  memberRow = {
    workspace_id: WORKSPACE_ID,
    user_id: ADMIN_ID,
    role: "admin",
    user_profiles: { id: ADMIN_ID, email: "ana@example.com", display_name: "Ana Reyes" },
  };
});

describe("ticket assignee", () => {
  it("assigns a ticket to a workspace admin, logs it, and notifies them", async () => {
    const { updateTicket } = await import("./store");

    const ticket = await updateTicket({ ...update, assigneeUserId: ADMIN_ID }, WORKSPACE_ID, "Olivia Owner", OWNER_ID);

    expect(ticket.assigneeUserId).toBe(ADMIN_ID);
    expect(callsTo("workspace_members", "select")[0].filters).toEqual({ workspace_id: WORKSPACE_ID, user_id: ADMIN_ID });
    const [write] = callsTo("tickets", "update");
    expect(write.payload).toMatchObject({ assignee_user_id: ADMIN_ID });
    expect(write.filters).toEqual({ workspace_id: WORKSPACE_ID, id: "TRG-1001" });
    expect(callsTo("ticket_activity", "insert")[0].payload).toMatchObject({ action: "Ticket updated", details: "Assigned to Ana Reyes." });
    expect(callsTo("notifications", "insert")[0].payload).toEqual([
      expect.objectContaining({
        workspace_id: WORKSPACE_ID,
        user_id: ADMIN_ID,
        type: "ticket_assigned",
        title: "Ticket TRG-1001 was assigned to you",
        link: "/tickets/TRG-1001",
        actor: "Olivia Owner",
      }),
    ]);
  });

  it("does not notify an admin who assigns a ticket to themselves", async () => {
    const { updateTicket } = await import("./store");

    await updateTicket({ ...update, assigneeUserId: ADMIN_ID }, WORKSPACE_ID, "Ana Reyes", ADMIN_ID);

    expect(callsTo("tickets", "update")[0].payload).toMatchObject({ assignee_user_id: ADMIN_ID });
    expect(callsTo("notifications", "insert")).toHaveLength(0);
  });

  // Leaving the column out of an unchanged save keeps ordinary ticket updates working
  // on a database that has not run the assignee migration yet.
  it("leaves the assignee column alone when the assignment did not change", async () => {
    ticketRow.assignee_user_id = ADMIN_ID;
    const { updateTicket } = await import("./store");

    await updateTicket({ ...update, status: "in-progress", assigneeUserId: ADMIN_ID }, WORKSPACE_ID, "Olivia Owner", OWNER_ID);

    expect(callsTo("tickets", "update")[0].payload).not.toHaveProperty("assignee_user_id");
    expect(callsTo("workspace_members", "select")).toHaveLength(0);
    expect(callsTo("notifications", "insert")).toHaveLength(0);
    expect(callsTo("ticket_activity", "insert")[0].payload).toMatchObject({ details: "Status changed from open to in-progress." });
  });

  it("unassigns a ticket when the assignee is cleared", async () => {
    ticketRow.assignee_user_id = ADMIN_ID;
    const { updateTicket } = await import("./store");

    const ticket = await updateTicket({ ...update, assigneeUserId: "" }, WORKSPACE_ID, "Olivia Owner", OWNER_ID);

    expect(ticket.assigneeUserId).toBeUndefined();
    expect(callsTo("tickets", "update")[0].payload).toMatchObject({ assignee_user_id: null });
    expect(callsTo("ticket_activity", "insert")[0].payload).toMatchObject({ details: "Unassigned." });
    expect(callsTo("notifications", "insert")).toHaveLength(0);
  });

  // Requesters can only open their own tickets, so assigning one to them would hand
  // out work nobody can see.
  it("refuses to assign a ticket to a requester or a non-member", async () => {
    const { updateTicket } = await import("./store");
    const message = "Tickets can only be assigned to an admin or owner of this workspace.";

    memberRow = { ...memberRow, role: "requester" };
    await expect(updateTicket({ ...update, assigneeUserId: ADMIN_ID }, WORKSPACE_ID, "Olivia Owner", OWNER_ID)).rejects.toThrow(message);

    memberRow = null;
    await expect(updateTicket({ ...update, assigneeUserId: ADMIN_ID }, WORKSPACE_ID, "Olivia Owner", OWNER_ID)).rejects.toThrow(message);

    expect(callsTo("tickets", "update")).toHaveLength(0);
    expect(callsTo("ticket_activity", "insert")).toHaveLength(0);
  });

  it("unassigns a departing member's tickets in that workspace only", async () => {
    const { unassignMemberTickets } = await import("./store");

    await unassignMemberTickets(WORKSPACE_ID, ADMIN_ID, "left");

    const [write] = callsTo("tickets", "update");
    expect(write.payload).toEqual({ assignee_user_id: null });
    expect(write.filters).toEqual({ workspace_id: WORKSPACE_ID, assignee_user_id: ADMIN_ID });
    // Nothing was assigned to them, so there is nothing to explain and no name lookup.
    expect(callsTo("ticket_activity", "insert")).toHaveLength(0);
    expect(callsTo("user_profiles", "select")).toHaveLength(0);
  });

  // Without this the history ends at "Assigned to Ana Reyes." on a ticket that reads
  // Unassigned, with nothing saying why.
  it("records why each ticket was unassigned", async () => {
    affectedTickets = [{ id: "TRG-1001", request_id: "REQ-1001" }, { id: "TRG-1002", request_id: null }];
    const { unassignMemberTickets } = await import("./store");

    await unassignMemberTickets(WORKSPACE_ID, ADMIN_ID, "left");
    await unassignMemberTickets(WORKSPACE_ID, ADMIN_ID, "removed");
    await unassignMemberTickets(WORKSPACE_ID, ADMIN_ID, "demoted");

    const entries = callsTo("ticket_activity", "insert").map((call) => call.payload as Record<string, unknown>);
    expect(entries).toHaveLength(6);
    expect(entries[0]).toMatchObject({
      workspace_id: WORKSPACE_ID,
      ticket_id: "TRG-1001",
      request_id: "REQ-1001",
      action: "Ticket updated",
      actor: "System",
      details: "Unassigned because Ana Reyes left the workspace.",
    });
    expect(entries[1]).toMatchObject({ ticket_id: "TRG-1002", request_id: null });
    expect(entries[2].details).toBe("Unassigned because Ana Reyes was removed from the workspace.");
    expect(entries[4].details).toBe("Unassigned because Ana Reyes is now a requester.");
  });

  // The membership change has already been committed by the time this runs.
  it("reports a failed unassign instead of failing the membership change", async () => {
    ticketsError = { message: "column tickets.assignee_user_id does not exist" };
    const { unassignMemberTickets } = await import("./store");

    await expect(unassignMemberTickets(WORKSPACE_ID, ADMIN_ID, "removed")).resolves.toBeUndefined();
    expect(captureOperationalError).toHaveBeenCalledWith(expect.any(Error), { area: "unassign_member_tickets" });
  });

  it("unassigns after a member leaves, is removed, or is demoted to requester", () => {
    const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");

    expect(actionsSource).toContain("await leaveWorkspace(workspaceId, user.id);\n    await unassignMemberTickets(workspaceId, user.id, \"left\");");
    expect(actionsSource).toContain("await removeWorkspaceMember(workspaceId, memberUserId, user.id);\n    await unassignMemberTickets(workspaceId, memberUserId, \"removed\");");
    expect(actionsSource).toContain('if (input.role === "requester") await unassignMemberTickets(workspace.id, input.userId, "demoted");');
  });

  it("offers only admins and owners as assignees", async () => {
    const { isWorkspaceAdmin, workspaceMemberName } = await import("./workspaces");
    const workspacesSource = readFileSync(new URL("./workspaces.ts", import.meta.url), "utf8");

    expect(workspacesSource).toContain(".filter((member) => isWorkspaceAdmin(member.role))");
    expect(isWorkspaceAdmin("requester")).toBe(false);
    expect(workspaceMemberName({ displayName: "Ana Reyes", email: "ana@example.com" })).toBe("Ana Reyes");
    expect(workspaceMemberName({ displayName: "", email: "ana@example.com" })).toBe("ana@example.com");
    expect(workspaceMemberName({ displayName: "", email: "" })).toBe("A member");
  });

  it("builds the assignee filter into ticket list links", async () => {
    const { ticketsHref } = await import("./ticket-links");
    const current = { filter: "all", q: "", page: 3, priority: "all", dept: "all", assignee: "all" };

    expect(ticketsHref("acme", current, { assignee: "me", page: 1 })).toBe("/w/acme/tickets?filter=all&assignee=me&page=1");
    expect(ticketsHref("acme", { ...current, assignee: "unassigned" }, { page: 2 })).toBe("/w/acme/tickets?filter=all&assignee=unassigned&page=2");
    expect(ticketsHref("acme", { ...current, assignee: "me" }, { assignee: "all" })).toBe("/w/acme/tickets?filter=all&page=3");
  });
});

describe("assigning at approval", () => {
  it("creates the ticket already assigned, says so in the approval entry, and notifies the assignee", async () => {
    const { approveRequest } = await import("./store");

    const ticket = await approveRequest({ ...approval, assigneeUserId: ADMIN_ID, note: "Toner is in the supply room." }, WORKSPACE_ID, owner);

    expect(ticket.assigneeUserId).toBe(ADMIN_ID);
    expect(callsTo("workspace_members", "select")[0].filters).toEqual({ workspace_id: WORKSPACE_ID, user_id: ADMIN_ID });
    expect(callsTo("tickets", "insert")[0].payload).toMatchObject({ request_id: "REQ-1001", status: "new", assignee_user_id: ADMIN_ID });
    expect(callsTo("ticket_activity", "insert")[0].payload).toMatchObject({
      action: "Ticket approved",
      actor: "Olivia Owner",
      details: "Approved as high priority for it. Assigned to Ana Reyes. Note: Toner is in the supply room.",
    });
    expect(callsTo("notifications", "insert")[0].payload).toEqual([
      expect.objectContaining({ user_id: ADMIN_ID, type: "ticket_assigned", body: "Front desk printer offline", actor: "Olivia Owner" }),
    ]);
  });

  it("leaves the ticket unassigned when no assignee is picked", async () => {
    const { approveRequest } = await import("./store");

    const ticket = await approveRequest({ ...approval, assigneeUserId: "" }, WORKSPACE_ID, owner);

    expect(ticket.assigneeUserId).toBeUndefined();
    expect(callsTo("tickets", "insert")[0].payload).not.toHaveProperty("assignee_user_id");
    expect(callsTo("ticket_activity", "insert")[0].payload).toMatchObject({ details: "Approved as high priority for it." });
    expect(callsTo("workspace_members", "select")).toHaveLength(0);
    expect(callsTo("notifications", "insert")).toHaveLength(0);
  });

  it("does not notify a reviewer who assigns the new ticket to themselves", async () => {
    const { approveRequest } = await import("./store");

    await approveRequest({ ...approval, assigneeUserId: ADMIN_ID }, WORKSPACE_ID, { id: ADMIN_ID, name: "Ana Reyes" });

    expect(callsTo("tickets", "insert")[0].payload).toMatchObject({ assignee_user_id: ADMIN_ID });
    expect(callsTo("notifications", "insert")).toHaveLength(0);
  });

  // The request is marked approved before the ticket is inserted, so a refusal has to
  // land before either write or the request would be approved with no ticket.
  it("refuses a requester as assignee before approving anything", async () => {
    memberRow = { ...memberRow, role: "requester" };
    const { approveRequest } = await import("./store");

    await expect(approveRequest({ ...approval, assigneeUserId: ADMIN_ID }, WORKSPACE_ID, owner)).rejects.toThrow(
      "Tickets can only be assigned to an admin or owner of this workspace."
    );

    expect(callsTo("requests", "update")).toHaveLength(0);
    expect(callsTo("tickets", "insert")).toHaveLength(0);
    expect(callsTo("ticket_activity", "insert")).toHaveLength(0);
  });

  it("offers the assignee picker only while the request is still undecided", () => {
    const reviewSource = readFileSync(new URL("../app/review/[id]/page.tsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
    const approveActionSource = actionsSource.slice(actionsSource.indexOf("export async function approveRequestAction("), actionsSource.indexOf("export async function rejectRequestAction("));

    expect(reviewSource).toContain("{decided ? null : (");
    expect(reviewSource).toContain('<select id="assigneeUserId" name="assigneeUserId" defaultValue="" className="select">');
    expect(approveActionSource).toContain('assigneeUserId: formText(formData, "assigneeUserId"),');
  });
});
