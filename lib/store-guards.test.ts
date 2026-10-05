import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const REQUESTER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_REQUESTER_ID = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;

// One entry per database round trip, whether a table query or an RPC.
const roundTrips: { target: string; op: string; payload?: unknown; filters: Row }[] = [];
let tables: Record<string, Row[]>;

function from(table: string) {
  const trip = { target: table, op: "select", payload: undefined as unknown, filters: {} as Row };
  const inFilters: Record<string, unknown[]> = {};
  let single = false;
  let head = false;

  const run = () => {
    roundTrips.push(trip);
    if (trip.op === "insert") return { data: null, error: null };
    const rows = (tables[table] ?? []).filter(
      (row) =>
        Object.entries(trip.filters).every(([column, value]) => !(column in row) || row[column] === value) &&
        Object.entries(inFilters).every(([column, values]) => !(column in row) || values.includes(row[column])),
    );
    if (head) return { data: null, count: rows.length, error: null };
    if (trip.op === "update") {
      const updated = rows.map((row) => ({ ...row, ...(trip.payload as Row) }));
      return { data: single ? updated[0] ?? null : updated, error: null };
    }
    return { data: single ? rows[0] ?? null : rows, error: null };
  };

  const chain: Record<string, unknown> = {
    select: (_columns?: string, options?: { head?: boolean }) => {
      if (options?.head) head = true;
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    not: () => chain,
    or: () => chain,
    eq: (column: string, value: unknown) => {
      trip.filters[column] = value;
      return chain;
    },
    in: (column: string, values: unknown[]) => {
      inFilters[column] = values;
      return chain;
    },
    insert: (payload: unknown) => {
      trip.op = "insert";
      trip.payload = payload;
      return chain;
    },
    update: (payload: unknown) => {
      trip.op = "update";
      trip.payload = payload;
      return chain;
    },
    maybeSingle: () => {
      single = true;
      return Promise.resolve(run());
    },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
  };
  return chain;
}

let sequence = 5000;
const client = {
  from,
  rpc: vi.fn((name: string, args: Row) => {
    roundTrips.push({ target: `rpc:${name}`, op: "rpc", filters: args });
    sequence += 1;
    return Promise.resolve({ data: `${String(args.target_prefix).replace("DEMO_", "")}-${sequence}`, error: null });
  }),
};

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: () => client,
  requireSupabaseAdminClient: () => client,
  getRuntimeSetupStatus: () => ({ missing: [] }),
  requestAttachmentBucket: () => "request-attachments",
}));
vi.mock("@/lib/monitoring", () => ({ captureOperationalError: vi.fn() }));

function request(id: string, overrides: Row = {}): Row {
  return {
    id,
    workspace_id: WORKSPACE_ID,
    requester_user_id: REQUESTER_ID,
    description: "The projector in the board room will not turn on.",
    location: "Board Room",
    contact_name: "Rina",
    urgency_note: "",
    status: "needs-review",
    created_at: "2026-06-01T08:00:00.000Z",
    ...overrides,
  };
}

function triage(id: string, requestId: string, overrides: Row = {}): Row {
  return {
    id,
    workspace_id: WORKSPACE_ID,
    request_id: requestId,
    source: "rules",
    title: "Projector issue at Board Room",
    category: "IT",
    priority: "medium",
    department: "it",
    summary: "IT should review the board room projector.",
    priority_reasoning: "Affects normal work without a safety risk.",
    similar_ticket_ids: [],
    created_at: "2026-06-01T08:01:00.000Z",
    ...overrides,
  };
}

function ticket(id: string, overrides: Row = {}): Row {
  return {
    id,
    workspace_id: WORKSPACE_ID,
    request_id: null,
    requester_user_id: REQUESTER_ID,
    assignee_user_id: null,
    title: "Projector issue at Board Room",
    description: "The projector in the board room will not turn on.",
    location: "Board Room",
    contact_name: "Rina",
    urgency_note: "",
    status: "open",
    priority: "medium",
    department: "it",
    category: "IT",
    triage_summary: "IT should review the board room projector.",
    priority_reasoning: "Affects normal work without a safety risk.",
    resolution_notes: "",
    created_at: "2026-06-01T09:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
    ...overrides,
  };
}

function tripsTo(target: string, op = "select") {
  return roundTrips.filter((trip) => trip.target === target && trip.op === op);
}

const admin = { id: "44444444-4444-4444-8444-444444444444", name: "Ana Reyes" };
const ticketUpdate = { ticketId: "TRG-1", status: "open" as const, priority: "medium" as const, department: "it", assigneeUserId: "", resolutionNotes: "", note: "" };

beforeEach(() => {
  roundTrips.length = 0;
  client.rpc.mockClear();
  tables = {
    workspaces: [{ id: WORKSPACE_ID, is_demo: false }],
    requests: [],
    ai_triage_results: [],
    tickets: [],
    request_attachments: [],
    ticket_activity: [],
    ticket_notes: [],
    workspace_members: [],
    notifications: [],
  };
});

// Every count here is a database round trip. These pin the shape of the hot reads so
// a per-row query cannot creep back in unnoticed.
describe("store query budgets", () => {
  it("reads the review queue in a fixed number of queries, whatever its length", async () => {
    const { listReviewItems } = await import("./store");
    const counts: number[] = [];

    for (const size of [2, 6]) {
      roundTrips.length = 0;
      tables.requests = Array.from({ length: size }, (_, index) => request(`REQ-${index + 1}`));
      tables.ai_triage_results = tables.requests.map((row, index) => triage(`TRI-${index + 1}`, String(row.id)));
      tables.tickets = [ticket("TRG-1"), ticket("TRG-2")];

      expect(await listReviewItems(WORKSPACE_ID)).toHaveLength(size);
      counts.push(roundTrips.length);
    }

    expect(counts).toEqual([4, 4]);
  });

  it("keeps each queued request's own latest triage and attachments", async () => {
    tables.requests = [request("REQ-1"), request("REQ-2")];
    // Newest first, the order the query asks for.
    tables.ai_triage_results = [
      triage("TRI-3", "REQ-1", { title: "Retriaged projector issue" }),
      triage("TRI-2", "REQ-2", { title: "Leak near the lobby" }),
      triage("TRI-1", "REQ-1", { title: "First projector draft" }),
    ];
    tables.request_attachments = [
      { id: "att-1", workspace_id: WORKSPACE_ID, request_id: "REQ-2", file_name: "leak.png", storage_path: "w/requests/REQ-2/leak.png", content_type: "image/png", size_bytes: 10 },
    ];

    const { listReviewItems } = await import("./store");
    const [first, second] = await listReviewItems(WORKSPACE_ID);

    expect(first.triage.title).toBe("Retriaged projector issue");
    expect(first.attachments).toEqual([]);
    expect(second.triage.title).toBe("Leak near the lobby");
    expect(second.attachments.map((attachment) => attachment.fileName)).toEqual(["leak.png"]);
  });

  it("reads tickets once for the dashboard and counts the queue instead of loading it", async () => {
    tables.requests = [request("REQ-1"), request("REQ-2", { status: "approved" })];
    tables.ai_triage_results = [triage("TRI-1", "REQ-1")];
    tables.tickets = [ticket("TRG-1"), ticket("TRG-2")];

    const { getDashboardData } = await import("./store");
    const data = await getDashboardData(WORKSPACE_ID);

    expect(data.counts.newRequests).toBe(1);
    expect(data.counts.openTickets).toBe(2);
    expect(data.featuredReview?.similarTickets.map((similar) => similar.id)).toEqual(["TRG-1", "TRG-2"]);
    expect(tripsTo("tickets")).toHaveLength(1);
    expect(roundTrips).toHaveLength(6);
  });

  it("looks up whether a workspace is a demo at most once across a submitted request", async () => {
    const { createRequest, saveTriageResult } = await import("./store");
    const created = await createRequest(
      { description: "The projector in the board room will not turn on.", location: "Board Room", contactName: "", urgencyNote: "" },
      { id: REQUESTER_ID, email: "rina@example.com", displayName: "Rina", role: "requester", isDemo: false },
      WORKSPACE_ID,
    );
    tables.requests = [request(created.id)];
    await saveTriageResult(
      created.id,
      { source: "rules", title: "Projector issue", category: "IT", priority: "medium", department: "it", summary: "IT should review the projector.", priorityReasoning: "Affects normal work.", similarTicketIds: [] },
      WORKSPACE_ID,
    );

    // Four ids are allocated (request, two activity entries, triage result).
    expect(client.rpc).toHaveBeenCalledTimes(4);
    expect(tripsTo("workspaces").length).toBeLessThanOrEqual(1);
  });
});

describe("what a requester can read on a ticket", () => {
  beforeEach(() => {
    tables.tickets = [
      ticket("TRG-1"),
      ticket("TRG-2", { requester_user_id: OTHER_REQUESTER_ID, title: "Projector issue in the HR office" }),
    ];
    tables.ticket_notes = [{ id: "NOTE-1", workspace_id: WORKSPACE_ID, ticket_id: "TRG-1", actor: "Ana Reyes", body: "Vendor is unreliable, do not promise a date.", created_at: "2026-06-01T10:00:00.000Z" }];
  });

  it("matches similar tickets against the requester's own tickets only", async () => {
    const { getTicketDetail } = await import("./store");
    const detail = await getTicketDetail("TRG-1", REQUESTER_ID, WORKSPACE_ID);

    expect(detail?.similarTickets).toEqual([]);
    expect(tripsTo("tickets").every((trip) => trip.filters.requester_user_id === REQUESTER_ID)).toBe(true);
  });

  it("still shows an admin every similar ticket in the workspace", async () => {
    const { getTicketDetail } = await import("./store");
    const detail = await getTicketDetail("TRG-1", undefined, WORKSPACE_ID);

    expect(detail?.similarTickets.map((similar) => similar.id)).toEqual(["TRG-2"]);
  });

  it("never loads internal notes for a requester", async () => {
    const { getTicketDetail } = await import("./store");

    const asRequester = await getTicketDetail("TRG-1", REQUESTER_ID, WORKSPACE_ID);
    expect(asRequester?.notes).toEqual([]);
    expect(tripsTo("ticket_notes")).toHaveLength(0);

    const asAdmin = await getTicketDetail("TRG-1", undefined, WORKSPACE_ID);
    expect(asAdmin?.notes.map((note) => note.body)).toEqual(["Vendor is unreliable, do not promise a date."]);
  });

  // The activity feed is on the requester's ticket page. The note is not.
  it("keeps an internal note's text out of the activity feed", async () => {
    const { updateTicket, INTERNAL_NOTE_ACTIVITY_TEXT } = await import("./store");
    const secret = "Requester has called three times, escalate quietly.";

    await updateTicket({ ...ticketUpdate, note: secret }, WORKSPACE_ID, admin.name, admin.id);

    const [noteInsert] = tripsTo("ticket_notes", "insert");
    const [activityInsert] = tripsTo("ticket_activity", "insert");
    expect((noteInsert.payload as Row).body).toBe(secret);
    expect((activityInsert.payload as Row).details).toBe(INTERNAL_NOTE_ACTIVITY_TEXT);
    expect(JSON.stringify(activityInsert.payload)).not.toContain(secret);
  });
});

describe("review decisions on a request that is already decided", () => {
  const approval = { requestId: "REQ-1", title: "Projector issue at Board Room", priority: "medium" as const, department: "it", summary: "IT should review the board room projector." };

  beforeEach(() => {
    tables.ai_triage_results = [triage("TRI-1", "REQ-1")];
  });

  it("does not reject a request that was already approved", async () => {
    tables.requests = [request("REQ-1", { status: "approved" })];
    const { rejectRequest } = await import("./store");

    await expect(rejectRequest("REQ-1", WORKSPACE_ID, admin)).rejects.toThrow("already reviewed");
    expect(tripsTo("requests", "update")[0].filters.status).toBe("needs-review");
    expect(tripsTo("ticket_activity", "insert")).toHaveLength(0);
    expect(tripsTo("notifications", "insert")).toHaveLength(0);
  });

  it("does not mark an already approved request as a duplicate", async () => {
    tables.requests = [request("REQ-1", { status: "approved" })];
    tables.tickets = [ticket("TRG-9")];
    const { markDuplicate } = await import("./store");

    await expect(markDuplicate("REQ-1", "TRG-9", WORKSPACE_ID, admin)).rejects.toThrow("already reviewed");
    expect(tripsTo("ticket_activity", "insert")).toHaveLength(0);
  });

  it.each(["rejected", "duplicate"])("does not turn a %s request into a ticket", async (status) => {
    tables.requests = [request("REQ-1", { status })];
    const { approveRequest } = await import("./store");

    await expect(approveRequest(approval, WORKSPACE_ID, admin)).rejects.toThrow("already reviewed");
    expect(tripsTo("requests", "update")).toHaveLength(0);
    expect(tripsTo("tickets", "insert")).toHaveLength(0);
  });

  it("approves only while the request still has the status it was read with", async () => {
    tables.requests = [request("REQ-1")];
    const { approveRequest } = await import("./store");

    const created = await approveRequest(approval, WORKSPACE_ID, admin);

    expect(created.requestId).toBe("REQ-1");
    expect(tripsTo("requests", "update")[0].filters.status).toBe("needs-review");
    expect(tripsTo("tickets", "insert")).toHaveLength(1);
  });

  it("still rejects a request that is waiting for review", async () => {
    tables.requests = [request("REQ-1")];
    const { rejectRequest } = await import("./store");

    await rejectRequest("REQ-1", WORKSPACE_ID, admin);

    expect(tripsTo("ticket_activity", "insert")).toHaveLength(1);
  });
});

describe("action and response guards", () => {
  const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
  const actionBody = (name: string) => {
    const body = actionsSource.slice(actionsSource.indexOf(`export async function ${name}(`));
    return body.slice(0, body.indexOf("\nexport async function "));
  };

  // Every review decision writes an activity row and a notification, so each one draws
  // on the demo write budget, not only approval.
  it.each(["approveRequestAction", "rejectRequestAction", "markDuplicateAction", "updateTicketAction"])("meters %s against the demo write budget", (name) => {
    expect(actionBody(name)).toContain("await enforceDemoMutationBudget(user);");
  });

  // Only PublicError text reaches the form. A plain Error here told the user nothing
  // about which file was refused or why.
  it("tells the user why an attachment was refused", () => {
    const validation = actionsSource.slice(actionsSource.indexOf("async function validateAttachmentSignature("), actionsSource.indexOf("async function removeUploadedAttachments("));

    expect(validation).not.toContain("throw new Error(");
    expect(validation).toContain('throw new PublicError("Attachments must be JPG, PNG, WebP, PDF, DOCX, TXT, CSV, or JSON files.");');
  });

  it("sends the baseline security headers on every route", () => {
    const configSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

    expect(configSource).toContain('source: "/:path*", headers: securityHeaders');
    for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Referrer-Policy", "Permissions-Policy"]) {
      expect(configSource).toContain(`key: "${header}"`);
    }
  });

  it("does not put a thrown error message in the activate redirect", () => {
    const routeSource = readFileSync(new URL("../app/w/[workspaceSlug]/activate/route.ts", import.meta.url), "utf8");

    expect(routeSource).not.toContain("error.message");
  });
});
