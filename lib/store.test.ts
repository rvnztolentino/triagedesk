import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const storeSource = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const resetSql = readFileSync(new URL("../supabase/reset_workspace_seed.sql", import.meta.url), "utf8");

const idPrefixes = [
  { prefix: "REQ", sequence: "entity_id_requests_seq", table: "requests" },
  { prefix: "TRG", sequence: "entity_id_tickets_seq", table: "tickets" },
  { prefix: "TRI", sequence: "entity_id_triage_seq", table: "ai_triage_results" },
  { prefix: "ACT", sequence: "entity_id_activity_seq", table: "ticket_activity" },
  { prefix: "NOTE", sequence: "entity_id_notes_seq", table: "ticket_notes" },
] as const;

function stubClient(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
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

    await expect(nextEntityId(client, "REQ")).resolves.toBe("REQ-1042");
    expect(rpc).toHaveBeenCalledWith("next_entity_id", { target_prefix: "REQ" });
  });

  it("surfaces a database failure instead of inventing an id", async () => {
    const { nextEntityId } = await import("./store");
    const { client } = stubClient({ error: { message: "connection reset" } });

    await expect(nextEntityId(client, "TRG")).rejects.toThrow("Generate TRG id: connection reset");
  });

  it("rejects an empty response rather than inserting a malformed id", async () => {
    const { nextEntityId } = await import("./store");
    const { client } = stubClient({ data: null });

    await expect(nextEntityId(client, "NOTE")).rejects.toThrow("the database returned no id");
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
      expect(storeSource).toContain(`nextEntityId(client, "${prefix}")`);
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
});
