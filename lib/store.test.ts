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
  // highest id in JS, and added one — a full-table scan per insert and a
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

  it("enforces the workspace cap when a demo workspace is claimed", () => {
    expect(schemaSql).toContain("raise exception 'Workspace limit reached.';");
    expect(schemaSql).toContain("raise exception 'This demo has already expired.';");
  });

  it("keeps every demo RPC off the public REST API", () => {
    for (const signature of [
      "delete_expired_demo_workspaces(integer)",
      "create_demo_workspace(text, integer)",
      "claim_demo_workspace(text, uuid)",
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
