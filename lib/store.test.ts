import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const storeSource = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const resetSql = readFileSync(new URL("../supabase/reset_workspace_seed.sql", import.meta.url), "utf8");
const pruneSql = readFileSync(new URL("../supabase/prune.sql", import.meta.url), "utf8");

const idPrefixes = [
  { prefix: "REQ", sequence: "entity_id_requests_seq", table: "requests" },
  { prefix: "TRG", sequence: "entity_id_tickets_seq", table: "tickets" },
  { prefix: "TRI", sequence: "entity_id_triage_seq", table: "ai_triage_results" },
  { prefix: "ACT", sequence: "entity_id_activity_seq", table: "ticket_activity" },
  { prefix: "NOTE", sequence: "entity_id_notes_seq", table: "ticket_notes" },
] as const;

const demoIdPrefixes = [
  { prefix: "REQ", sequence: "entity_id_demo_requests_seq" },
  { prefix: "TRG", sequence: "entity_id_demo_tickets_seq" },
  { prefix: "TRI", sequence: "entity_id_demo_triage_seq" },
  { prefix: "ACT", sequence: "entity_id_demo_activity_seq" },
  { prefix: "NOTE", sequence: "entity_id_demo_notes_seq" },
] as const;

// The id path now also asks whether the workspace is a demo workspace, so the stub
// answers both the RPC and that lookup.
function stubClient(result: { data?: unknown; error?: { message: string } | null; isDemo?: boolean }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { is_demo: result.isDemo === true }, error: null });
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
  });
  return { client: { rpc, from } as unknown as SupabaseClient, rpc };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase store setup detection", () => {
  it("returns setup-required dashboard data when Supabase and Groq are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("AI_PROVIDER", "rules");
    vi.stubEnv("GROQ_API_KEY", "");

    const { getDashboardData, listDepartments } = await import("./store");
    const dashboard = await getDashboardData();
    const departments = await listDepartments();

    expect(dashboard.setupRequired).toEqual(
      expect.arrayContaining(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AI_PROVIDER=groq", "GROQ_API_KEY"])
    );
    expect(dashboard.counts.openTickets).toBe(0);
    expect(departments.map((department) => department.id)).toContain("maintenance");
  });
});

describe("entity id generation", () => {
  it("allocates ids from the database sequence instead of scanning the table", async () => {
    const { nextEntityId } = await import("./store");
    const { client, rpc } = stubClient({ data: "REQ-1042" });

    await expect(nextEntityId(client, "REQ", "ws-1")).resolves.toBe("REQ-1042");
    expect(rpc).toHaveBeenCalledWith("next_entity_id", { target_prefix: "REQ" });
  });

  it("surfaces a database failure instead of inventing an id", async () => {
    const { nextEntityId } = await import("./store");
    const { client } = stubClient({ error: { message: "connection reset" } });

    await expect(nextEntityId(client, "TRG", "ws-1")).rejects.toThrow("Generate TRG id: connection reset");
  });

  it("rejects an empty response rather than inserting a malformed id", async () => {
    const { nextEntityId } = await import("./store");
    const { client } = stubClient({ data: null });

    await expect(nextEntityId(client, "NOTE", "ws-1")).rejects.toThrow("the database returned no id");
  });

  // Demo rows draw from their own sequences so demo traffic never consumes ticket
  // numbers a real workspace would otherwise use.
  it("draws demo workspace ids from the demo sequence", async () => {
    const { nextEntityId } = await import("./store");
    const { client, rpc } = stubClient({ data: "TRG-900001", isDemo: true });

    await expect(nextEntityId(client, "TRG", "demo-ws")).resolves.toBe("TRG-900001");
    expect(rpc).toHaveBeenCalledWith("next_entity_id", { target_prefix: "DEMO_TRG" });
  });

  it("leaves real workspaces on the real sequence", async () => {
    const { nextEntityId } = await import("./store");
    const { client, rpc } = stubClient({ data: "TRG-1005", isDemo: false });

    await nextEntityId(client, "TRG", "real-ws");
    expect(rpc).toHaveBeenCalledWith("next_entity_id", { target_prefix: "TRG" });
  });

  // The old generator selected every row in the table across all workspaces, took the
  // highest id in JS, and added one, a full-table scan per insert and a
  // read-modify-write race that could hand two concurrent writers the same id.
  it("no longer derives ids from a client-side scan", () => {
    expect(storeSource).not.toContain("nextNumericId");
    expect(storeSource).not.toMatch(/\.like\((\w+), `\$\{prefix\}-%`\)/);
    expect(storeSource).toContain('client.rpc("next_entity_id"');
  });

  it("routes every id prefix through the sequence RPC", () => {
    for (const { prefix } of idPrefixes) {
      expect(storeSource).toMatch(new RegExp(`nextEntityId\\(client, "${prefix}", [\\w.]+\\)`));
    }
  });
});

describe("entity id sequences (schema)", () => {
  it("creates a sequence for every id prefix", () => {
    for (const { sequence } of idPrefixes) {
      expect(schemaSql).toContain(`create sequence if not exists ${sequence};`);
    }
  });

  it("seeds each sequence from the highest existing id in its own table", () => {
    for (const { prefix, sequence, table } of idPrefixes) {
      expect(schemaSql).toContain(`perform setval('${sequence}', greatest(999,`);
      expect(schemaSql).toContain(`from ${table} where id ~ '^${prefix}-[0-9]+$'`);
    }
  });

  // Re-running schema.sql while the app is live must not pull a sequence backwards
  // onto ids concurrent writers have already taken but not yet committed. Once a
  // sequence has been used it is always ahead of every id it issued, so seeding is
  // guarded to the run that creates it.
  it("seeds each sequence only once, never on a re-run", () => {
    for (const { sequence } of idPrefixes) {
      expect(schemaSql).toContain(
        `where schemaname = 'public' and sequencename = '${sequence}') is null then`
      );
    }
    expect(schemaSql).not.toContain("select setval('entity_id_");
  });

  it("maps prefixes to sequences through a whitelist so nextval cannot be steered", () => {
    expect(schemaSql).toContain("create or replace function next_entity_id(target_prefix text)");
    expect(schemaSql).toContain("raise exception 'Unknown entity id prefix: %', target_prefix;");
    for (const { prefix, sequence } of idPrefixes) {
      expect(schemaSql).toContain(`when '${prefix}' then '${sequence}'`);
    }
  });

  it("keeps the id RPC off the public REST API", () => {
    expect(schemaSql).toContain("revoke all on function next_entity_id(text) from public, anon, authenticated;");
    expect(schemaSql).toContain("grant execute on function next_entity_id(text) to service_role;");
  });

  // The seed inserts explicit ids (REQ-1001, TRG-1043, …), which bypass the sequences.
  // Without these setval calls the first insert after a reset collides on the PK.
  it("re-points the sequences after the demo seed inserts explicit ids", () => {
    for (const { sequence } of idPrefixes) {
      expect(resetSql).toContain(`select setval('${sequence}', greatest(`);
    }
  });

  it("gives demo rows their own high-offset sequences", () => {
    for (const { sequence } of demoIdPrefixes) {
      expect(schemaSql).toContain(`create sequence if not exists ${sequence} start with 900000;`);
    }
  });

  // Both seeds took max(id) over the whole table, demo rows included, so seeding a
  // database that had live demo rows put the REAL sequences in the 900000 space. The
  // sequence is shared by every real workspace, so every one of them then drew a
  // 900000+ id: a primary key collision where a demo row held that id, and a real row
  // wearing a demo-shaped id where the demo rows had a gap.
  it("never seeds a real sequence from a demo id", () => {
    for (const { prefix } of idPrefixes) {
      const exclusion = `and (regexp_replace(id, '^${prefix}-', ''))::bigint < 900000`;
      expect(schemaSql).toContain(exclusion);
      expect(resetSql).toContain(exclusion);
    }
  });

  // greatest() carries the sequence's own last_value forward so a live sequence is not
  // pulled backwards. Counting a contaminated last_value would preserve the damage
  // through every future reset, so that term stops below the demo floor too.
  it("lets a reset repair a contaminated sequence instead of preserving it", () => {
    for (const { sequence } of idPrefixes) {
      expect(resetSql).toContain(`and sequencename = '${sequence}' and last_value < 900000`);
    }
  });

  // A database that already hit this has used its sequences, which makes the one-time
  // backfill's `is null` guard a permanent no-op. The repair has to run every time or
  // an affected database can never heal itself.
  it("repairs a real sequence that is already sitting in the demo range", () => {
    expect(schemaSql).toContain("demo_floor constant bigint := 900000;");
    expect(schemaSql).toContain("if last_used is not null and last_used >= demo_floor then");
    expect(schemaSql).toContain("perform setval(format('public.%I', entry.real_seq)::regclass, greatest(999, highest_real));");
    for (const { sequence, table } of idPrefixes) {
      expect(schemaSql).toContain(`('${sequence}',`);
      expect(schemaSql).toContain(`'${table}',`);
    }
  });

  // The mirror image: a demo sequence behind the demo rows that exist would fail the
  // same way, so the repair covers both directions rather than trading one for the other.
  it("keeps each demo sequence at or above the demo rows that exist", () => {
    expect(schemaSql).toContain("if last_used is not null and last_used < highest_demo then");
    expect(schemaSql).toContain("perform setval(format('public.%I', entry.demo_seq)::regclass, highest_demo);");
    for (const { sequence } of demoIdPrefixes) {
      expect(schemaSql).toContain(`'${sequence}',`);
    }
  });

  // The DEMO_ key selects the demo sequence but the id a user sees keeps the normal
  // prefix, so a demo ticket reads TRG-900123 rather than DEMO_TRG-900123.
  it("routes demo prefixes to demo sequences while keeping the visible prefix", () => {
    for (const { prefix, sequence } of demoIdPrefixes) {
      expect(schemaSql).toContain(`when 'DEMO_${prefix}' then '${sequence}'`);
    }
    expect(schemaSql).toContain("when target_prefix like 'DEMO\\_%' then substring(target_prefix from 6)");
    expect(schemaSql).toContain("return visible_prefix || '-' || nextval(target_sequence);");
  });
});

// Postgres indexes the referenced side of a foreign key but never the referencing
// side, so every one of these has to be declared by hand. A missing entry here is a
// seq scan per child table on any cascading delete, which is exactly what the
// workspace-delete, account-delete, and demo-cleanup paths do.
describe("foreign-key covering indexes", () => {
  const fkIndexes = [
    "create index if not exists ai_triage_results_request_id_idx on ai_triage_results (request_id);",
    "create index if not exists ai_triage_results_workspace_department_idx on ai_triage_results (workspace_id, department);",
    "create index if not exists notifications_workspace_id_idx on notifications (workspace_id);",
    "create index if not exists request_attachments_request_id_idx on request_attachments (request_id);",
    "create index if not exists ticket_activity_request_id_idx on ticket_activity (request_id);",
    "create index if not exists ticket_activity_workspace_request_idx on ticket_activity (workspace_id, request_id);",
    "create index if not exists ticket_activity_workspace_ticket_idx on ticket_activity (workspace_id, ticket_id);",
    "create index if not exists tickets_request_id_idx on tickets (request_id);",
    "create index if not exists tickets_workspace_department_idx on tickets (workspace_id, department);",
    "create index if not exists workspace_invites_created_by_idx on workspace_invites (created_by);",
    "create index if not exists workspaces_created_by_idx on workspaces (created_by);",
  ];

  it.each(fkIndexes)("declares %s", (statement) => {
    expect(schemaSql).toContain(statement);
  });

  it("keeps the sparse duplicate-link index partial", () => {
    expect(schemaSql).toContain(
      "create index if not exists tickets_duplicate_of_ticket_id_idx on tickets (duplicate_of_ticket_id) where duplicate_of_ticket_id is not null;"
    );
  });

  it("adds the ticket assignee column with a partial covering index", () => {
    expect(schemaSql).toContain("alter table tickets add column if not exists assignee_user_id uuid references user_profiles(id) on delete set null;");
    expect(schemaSql).toContain(
      "create index if not exists tickets_assignee_user_id_idx on tickets (assignee_user_id) where assignee_user_id is not null;"
    );
  });
});

describe("live demo schema", () => {
  it("marks demo workspaces and demo profiles with their own columns", () => {
    expect(schemaSql).toContain("alter table workspaces add column if not exists is_demo boolean not null default false;");
    expect(schemaSql).toContain("alter table workspaces add column if not exists expires_at timestamptz;");
    expect(schemaSql).toContain("alter table user_profiles add column if not exists is_demo boolean not null default false;");
  });

  it("indexes only expired demo workspaces so the cleanup sweep stays cheap", () => {
    expect(schemaSql).toContain("create index if not exists workspaces_demo_expiry_idx on workspaces (expires_at) where is_demo;");
  });

  // A demo session id comes from a signed cookie, but the RPC is the last line of
  // defense and must not accept anything that could widen the slug or the email.
  it("constrains the demo session id to a uuid inside the clone RPC", () => {
    expect(schemaSql).toContain("if target_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then");
    expect(schemaSql).toContain("raise exception 'Demo session id is invalid.';");
  });

  it("uses the reserved .invalid TLD so demo emails cannot collide with real accounts", () => {
    expect(schemaSql).toContain("'demo-' || target_session_id || '@demo.invalid'");
  });

  // The clone must rewrite every cross-reference, including similar_ticket_ids, which
  // is a plain text[] with no foreign key to catch a stale pointer.
  it("remaps cloned cross-references onto the new workspace's ids", () => {
    expect(schemaSql).toContain("request_map ->> r.id");
    expect(schemaSql).toContain("ticket_map ->> r.duplicate_of_ticket_id");
    expect(schemaSql).toContain("request_map ->> t.request_id");
    expect(schemaSql).toContain("ticket_map ->> t.duplicate_of_ticket_id");
    expect(schemaSql).toContain("coalesce(ticket_map ->> old_ticket_id, old_ticket_id)");
  });

  it("bounds the opportunistic cleanup so it cannot stall a visitor", () => {
    expect(schemaSql).toContain("create or replace function delete_expired_demo_workspaces(target_batch_size integer default 5)");
    expect(schemaSql).toContain("batch_size := least(greatest(coalesce(target_batch_size, 5), 0), 50);");
    expect(schemaSql).toContain("for update skip locked");
    expect(schemaSql).toContain("perform delete_expired_demo_workspaces(5);");
  });

  // Defense in depth: the app layer blocks these too, but an app-layer miss must not
  // become unbounded anonymous workspace creation or a demo session inside a real
  // workspace.
  it("blocks demo profiles from creating or joining real workspaces in the database", () => {
    expect(schemaSql).toContain("raise exception 'Demo sessions cannot create workspaces.';");
    expect(schemaSql).toContain("raise exception 'Demo sessions cannot join workspaces.';");
  });

  // The only function in the schema that could reassign workspace ownership. It is
  // dropped rather than left dormant, so re-running this file removes it from a
  // database that still has it.
  it("drops the claim RPC instead of leaving it callable", () => {
    expect(schemaSql).toContain("drop function if exists claim_demo_workspace(text, uuid);");
    expect(schemaSql).not.toContain("create or replace function claim_demo_workspace");
    expect(schemaSql).not.toContain("grant execute on function claim_demo_workspace");
  });

  it("keeps every demo RPC off the public REST API", () => {
    for (const signature of [
      "delete_expired_demo_workspaces(integer)",
      "create_demo_workspace(text, integer)",
    ]) {
      expect(schemaSql).toContain(`revoke all on function ${signature} from public, anon, authenticated;`);
      expect(schemaSql).toContain(`grant execute on function ${signature} to service_role;`);
    }
  });

  it("cleans up expired demo workspaces and orphaned demo profiles in the prune script", () => {
    expect(pruneSql).toContain("delete from workspaces");
    expect(pruneSql).toContain("where is_demo");
    expect(pruneSql).toContain("and not exists (select 1 from workspace_members m where m.user_id = p.id);");
  });
});

describe("ticket updates", () => {
  const resolvedAt = "2026-05-20T05:30:00.000Z";
  const closedAt = "2026-05-20T06:00:00.000Z";
  const timestamp = "2026-06-01T09:00:00.000Z";

  it("stamps the first resolve and close and keeps them while the state holds", async () => {
    const { ticketStatusTimestamps } = await import("./store");

    expect(ticketStatusTimestamps("resolved", {}, timestamp)).toEqual({ resolvedAt: timestamp, closedAt: null });
    expect(ticketStatusTimestamps("resolved", { resolvedAt }, timestamp)).toEqual({ resolvedAt, closedAt: null });
    expect(ticketStatusTimestamps("closed", { resolvedAt }, timestamp)).toEqual({ resolvedAt, closedAt: timestamp });
    expect(ticketStatusTimestamps("closed", { resolvedAt, closedAt }, timestamp)).toEqual({ resolvedAt, closedAt });
    // Closing without resolving is not a resolution, so it must not invent one.
    expect(ticketStatusTimestamps("closed", {}, timestamp)).toEqual({ resolvedAt: null, closedAt: timestamp });
  });

  // A reopened ticket that kept resolved_at still counted toward the dashboard's
  // average resolution time and 7-day resolved trend.
  it("clears the resolve and close times when a ticket is reopened", async () => {
    const { ticketStatusTimestamps } = await import("./store");

    for (const status of ["new", "open", "in-progress"] as const) {
      expect(ticketStatusTimestamps(status, { resolvedAt, closedAt }, timestamp)).toEqual({ resolvedAt: null, closedAt: null });
    }
    expect(ticketStatusTimestamps("resolved", { resolvedAt, closedAt }, timestamp)).toEqual({ resolvedAt, closedAt: null });
  });

  it("saves and logs a priority change from the ticket update form", () => {
    const updateTicketSource = storeSource.slice(storeSource.indexOf("export async function updateTicket("), storeSource.indexOf("export async function getDashboardData("));
    const formSource = readFileSync(new URL("../components/ticket-update-form.tsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");

    expect(updateTicketSource).toContain("priority: input.priority,");
    expect(updateTicketSource).toContain("`Priority changed from ${ticket.priority} to ${input.priority}.`");
    expect(formSource).toContain('<select id="priority" name="priority" defaultValue={priority} className="select">');
    expect(actionsSource).toContain('priority: formText(formData, "priority"),');
  });

  // "Assigned" used to count in-progress tickets, which said nothing about ownership.
  it("counts assigned tickets by assignee, not by status", () => {
    expect(storeSource).toContain("assigned: activeTickets.filter((ticket) => ticket.assigneeUserId).length,");
  });

  // The stored reasoning argues for the AI's priority. Once an admin picks a different
  // one, the ticket page has to say so or the badge and the reasoning contradict.
  it("flags AI reasoning that no longer matches the ticket priority", () => {
    const detailSource = storeSource.slice(storeSource.indexOf("export async function getTicketDetail("), storeSource.indexOf("export async function getSimilarTickets("));
    const pageSource = readFileSync(new URL("../app/tickets/[id]/page.tsx", import.meta.url), "utf8");

    expect(detailSource).toContain("ticket.requestId ? getLatestTriage(client, ticket.requestId, workspaceId) : undefined,");
    expect(detailSource).toContain("aiPriority: triage?.priority,");
    expect(pageSource).toContain("{aiPriority && aiPriority !== ticket.priority ? (");
    expect(pageSource).toContain("AI suggested {aiPriority} priority. This ticket is now {ticket.priority}, so the reasoning above describes the original suggestion.");
  });

  // The summary under "AI triage summary" is whatever the admin saved at approval,
  // so a rewritten one must not pass as the AI's own words.
  it("flags a triage summary an admin rewrote at approval", async () => {
    const { triageSummaryEdited } = await import("./store");
    const aiSummary = "Printer offline at the front desk.\nVisitors cannot check in.";

    expect(triageSummaryEdited(aiSummary, "Front desk printer is down. Swap the toner first.")).toBe(true);
    expect(triageSummaryEdited(aiSummary, aiSummary)).toBe(false);
    // A textarea round trip changes line breaks and trailing space, not the wording.
    expect(triageSummaryEdited(aiSummary, "Printer offline at the front desk.\r\nVisitors cannot check in.  ")).toBe(false);
    // Seeded tickets have no source request, so there is no AI summary to compare.
    expect(triageSummaryEdited(undefined, "Anything")).toBe(false);

    const pageSource = readFileSync(new URL("../app/tickets/[id]/page.tsx", import.meta.url), "utf8");
    expect(storeSource).toContain("summaryEdited: triageSummaryEdited(triage?.summary, ticket.triageSummary),");
    expect(pageSource).toContain('{summaryEdited ? <span className="badge" data-hue="neutral">Edited by admin</span> : null}');
  });
});
