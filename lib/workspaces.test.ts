import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { WorkspaceInviteRecord } from "./schema";
import {
  canCreateWorkspaceInvite,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_INVITE_CODE,
  DEMO_WORKSPACE_SLUG,
  isWorkspaceAdmin,
  isWorkspaceInviteActive,
  normalizeWorkspaceInviteCode,
} from "./workspaces";

const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const resetSql = readFileSync(new URL("../supabase/reset_workspace_seed.sql", import.meta.url), "utf8");

describe("workspace foundation", () => {
  it("defines a stable demo workspace for transitional routes and seed data", () => {
    expect(DEMO_WORKSPACE_ID).toBe("00000000-0000-4000-8000-000000000001");
    expect(DEMO_WORKSPACE_SLUG).toBe("demo-school");
    expect(DEMO_WORKSPACE_INVITE_CODE).toBe("DEMO-SCHOOL-2026");
    expect(schemaSql).toContain("'Demo School', 'demo-school'");
    expect(schemaSql).toContain("'DEMO-SCHOOL-2026'");
    expect(resetSql).toContain("'DEMO-SCHOOL-2026'");
  });

  it("treats only workspace owners and admins as privileged", () => {
    expect(isWorkspaceAdmin("owner")).toBe(true);
    expect(isWorkspaceAdmin("admin")).toBe(true);
    expect(isWorkspaceAdmin("requester")).toBe(false);
  });

  it("adds workspace ownership and RLS to every workspace-owned table", () => {
    const tables = [
      "requests",
      "ai_triage_results",
      "tickets",
      "ticket_activity",
      "ticket_notes",
      "request_attachments",
      "workspace_metadata",
    ];

    for (const table of tables) {
      expect(schemaSql).toContain(`alter table ${table} enable row level security;`);
      expect(schemaSql).toMatch(new RegExp(`create table if not exists ${table} \\([\\s\\S]*?workspace_id uuid not null references workspaces\\(id\\)`));
    }
  });

  it("scopes demo reset deletes without clearing other workspaces", () => {
    expect(resetSql).toContain(`delete from requests where workspace_id = '${DEMO_WORKSPACE_ID}'`);
    expect(resetSql).not.toMatch(/delete from requests;\s/);
    expect(resetSql).toContain("on conflict (workspace_id, key)");
  });

  it("enforces requester ownership and privileged workspace visibility in SQL", () => {
    expect(schemaSql).toContain("requester_user_id = auth.uid() or has_workspace_role(workspace_id, array['admin', 'owner'])");
    expect(schemaSql).toContain("and is_workspace_member(target_workspace_id)");
    expect(schemaSql).toContain("create policy workspace_members_update_owner");
    expect(schemaSql).toContain("create policy workspace_invites_insert_admin");
    expect(schemaSql).toContain("can_create_workspace_invite(workspace_id, role)");
    expect(schemaSql).toContain("create policy workspace_invites_update_owner");
  });

  it("allows invite creation only for the permitted workspace roles", () => {
    expect(canCreateWorkspaceInvite("owner", "requester")).toBe(true);
    expect(canCreateWorkspaceInvite("owner", "admin")).toBe(true);
    expect(canCreateWorkspaceInvite("admin", "requester")).toBe(true);
    expect(canCreateWorkspaceInvite("admin", "admin")).toBe(false);
    expect(canCreateWorkspaceInvite("requester", "requester")).toBe(false);
  });

  it("normalizes invite codes and rejects inactive invites", () => {
    const activeInvite: WorkspaceInviteRecord = {
      id: "invite-1",
      workspaceId: DEMO_WORKSPACE_ID,
      code: DEMO_WORKSPACE_INVITE_CODE,
      role: "requester",
      isReusable: false,
      createdAt: "2026-06-01T00:00:00.000Z",
    };

    expect(normalizeWorkspaceInviteCode(" demo-school-2026 ")).toBe(DEMO_WORKSPACE_INVITE_CODE);
    expect(isWorkspaceInviteActive(activeInvite, new Date("2026-06-01T00:00:00.000Z"))).toBe(true);
    expect(isWorkspaceInviteActive({ ...activeInvite, usedAt: "2026-06-01T00:01:00.000Z" })).toBe(false);
    expect(isWorkspaceInviteActive({ ...activeInvite, usedAt: "2026-06-01T00:01:00.000Z", isReusable: true })).toBe(true);
    expect(isWorkspaceInviteActive({ ...activeInvite, revokedAt: "2026-06-01T00:01:00.000Z" })).toBe(false);
    expect(isWorkspaceInviteActive({ ...activeInvite, expiresAt: "2026-06-01T00:00:00.000Z" }, new Date("2026-06-01T00:00:00.000Z"))).toBe(false);
  });
});
