import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { WorkspaceInviteRecord } from "./schema";
import {
  canCreateWorkspaceInvite,
  canManageWorkspaceInvite,
  canRemoveWorkspaceMember,
  assertWorkspaceMutable,
  DEMO_PREVIEW_LOCK_MESSAGE,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_INVITE_CODE,
  DEMO_WORKSPACE_SLUG,
  getPostAuthWorkspacePath,
  isWorkspaceAdmin,
  isWorkspaceInviteActive,
  isWorkspacePreview,
  MAX_ACTIVE_WORKSPACE_INVITES,
  MAX_WORKSPACE_MEMBERS,
  normalizeWorkspaceInviteCode,
  workspaceInviteLink,
  workspaceSlugFromName,
} from "./workspaces";

const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const resetSql = readFileSync(new URL("../supabase/reset_workspace_seed.sql", import.meta.url), "utf8");
const authSource = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
const ticketsSource = readFileSync(new URL("../app/tickets/page.tsx", import.meta.url), "utf8");
const workspaceDashboardSource = readFileSync(new URL("../app/onboarding/page.tsx", import.meta.url), "utf8");
const workspaceOpenLinkSource = readFileSync(new URL("../components/workspace-open-link.tsx", import.meta.url), "utf8");
const appLayoutSource = readFileSync(new URL("../components/app-layout.tsx", import.meta.url), "utf8");
const themeControlsSource = readFileSync(new URL("../components/theme-controls.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/settings/page.tsx", import.meta.url), "utf8");
const globalStylesSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("workspace foundation", () => {
  it("defines a stable demo workspace for transitional routes and seed data", () => {
    expect(DEMO_WORKSPACE_ID).toBe("00000000-0000-4000-8000-000000000001");
    expect(DEMO_WORKSPACE_SLUG).toBe("demo-clinic");
    expect(DEMO_WORKSPACE_INVITE_CODE).toBe("DEMO-CLINIC-2026");
    expect(schemaSql).toContain("'Demo Clinic', 'demo-clinic'");
    expect(schemaSql).toContain("'DEMO-CLINIC-2026'");
    expect(resetSql).toContain("'DEMO-CLINIC-2026'");
  });

  it("treats only workspace owners and admins as privileged", () => {
    expect(isWorkspaceAdmin("owner")).toBe(true);
    expect(isWorkspaceAdmin("admin")).toBe(true);
    expect(isWorkspaceAdmin("requester")).toBe(false);
  });

  it("treats Demo Clinic as a locked preview workspace", () => {
    expect(isWorkspacePreview(DEMO_WORKSPACE_ID)).toBe(true);
    expect(isWorkspacePreview("00000000-0000-4000-8000-000000000099")).toBe(false);
    expect(() => assertWorkspaceMutable(DEMO_WORKSPACE_ID)).toThrow(DEMO_PREVIEW_LOCK_MESSAGE);
    expect(() => assertWorkspaceMutable("00000000-0000-4000-8000-000000000099")).not.toThrow();
    expect(actionsSource).toContain("assertWorkspaceMutable(workspace.id)");
    expect(storeSource).toContain("assertWorkspaceMutable(workspaceId)");
    expect(authSource).toContain('access.membership.role !== "owner" || isWorkspacePreview(access.workspace.id)');
    expect(appLayoutSource).toContain("Preview locked.");
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
    expect(schemaSql).toContain("create policy workspace_members_delete_allowed");
    expect(schemaSql).toContain("create policy workspace_invites_insert_admin");
    expect(schemaSql).toContain("can_create_workspace_invite(workspace_id, role)");
    expect(schemaSql).toContain("create policy workspace_invites_update_owner");
  });

  it("backfills workspace departments before enforcing department foreign keys", () => {
    const seedIndex = schemaSql.indexOf("cross join (");
    const importedIndex = schemaSql.indexOf("with used_departments as");
    const fkIndex = schemaSql.indexOf("ai_triage_results_workspace_department_fkey");

    expect(seedIndex).toBeGreaterThan(-1);
    expect(importedIndex).toBeGreaterThan(seedIndex);
    expect(fkIndex).toBeGreaterThan(importedIndex);
    expect(schemaSql).toContain("select w.id, seed.id, seed.name, seed.description");
    expect(schemaSql).toContain("on conflict (workspace_id, id) do nothing");
  });

  it("allows invite creation only for the permitted workspace roles", () => {
    expect(canCreateWorkspaceInvite("owner", "requester")).toBe(true);
    expect(canCreateWorkspaceInvite("owner", "admin")).toBe(true);
    expect(canCreateWorkspaceInvite("admin", "requester")).toBe(true);
    expect(canCreateWorkspaceInvite("admin", "admin")).toBe(false);
    expect(canCreateWorkspaceInvite("requester", "requester")).toBe(false);
  });

  it("allows owners to remove members and admins to remove requesters only", () => {
    expect(canRemoveWorkspaceMember("owner", "owner")).toBe(true);
    expect(canRemoveWorkspaceMember("owner", "admin")).toBe(true);
    expect(canRemoveWorkspaceMember("owner", "requester")).toBe(true);
    expect(canRemoveWorkspaceMember("admin", "requester")).toBe(true);
    expect(canRemoveWorkspaceMember("admin", "admin")).toBe(false);
    expect(canRemoveWorkspaceMember("admin", "owner")).toBe(false);
    expect(canRemoveWorkspaceMember("requester", "requester")).toBe(false);
    expect(schemaSql).toContain("create or replace function can_remove_workspace_member");
    expect(schemaSql).toContain("(user_id = auth.uid() and role <> 'owner')");
    expect(schemaSql).toContain("or can_remove_workspace_member(workspace_id, user_id)");
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

    expect(normalizeWorkspaceInviteCode(" demo-clinic-2026 ")).toBe(DEMO_WORKSPACE_INVITE_CODE);
    expect(normalizeWorkspaceInviteCode(`http://localhost:3000/join/demo-clinic?code=${DEMO_WORKSPACE_INVITE_CODE}`)).toBe(DEMO_WORKSPACE_INVITE_CODE);
    expect(() => normalizeWorkspaceInviteCode("http://localhost:3000/join/demo-clinic")).toThrow("Enter a valid invite code or invite link.");
    expect(isWorkspaceInviteActive(activeInvite, new Date("2026-06-01T00:00:00.000Z"))).toBe(true);
    expect(isWorkspaceInviteActive({ ...activeInvite, usedAt: "2026-06-01T00:01:00.000Z" })).toBe(false);
    expect(isWorkspaceInviteActive({ ...activeInvite, usedAt: "2026-06-01T00:01:00.000Z", isReusable: true })).toBe(true);
    expect(isWorkspaceInviteActive({ ...activeInvite, revokedAt: "2026-06-01T00:01:00.000Z" })).toBe(false);
    expect(isWorkspaceInviteActive({ ...activeInvite, expiresAt: "2026-06-01T00:00:00.000Z" }, new Date("2026-06-01T00:00:00.000Z"))).toBe(false);
  });

  it("generates workspace slugs and centralized invite links", () => {
    expect(workspaceSlugFromName("Acme Clinic")).toBe("acme-clinic");
    expect(workspaceSlugFromName("IT")).toBe("it-workspace");
    expect(workspaceInviteLink("demo-clinic", DEMO_WORKSPACE_INVITE_CODE)).toBe("/join/demo-clinic?code=DEMO-CLINIC-2026");
    expect(getPostAuthWorkspacePath()).toBe("/onboarding");
  });

  it("defines atomic server-only create and invite join functions", () => {
    expect(schemaSql).toContain("create or replace function create_workspace_with_owner");
    expect(schemaSql).toContain("create or replace function join_workspace_by_invite");
    expect(schemaSql).toContain("and i.code = upper(trim(target_invite_code))");
    expect(schemaSql).toContain("and i.revoked_at is null");
    expect(schemaSql).toContain("and (i.expires_at is null or i.expires_at > now())");
    expect(schemaSql).toContain("and (i.is_reusable or i.used_at is null)");
    expect(schemaSql).toContain("select w.id, w.name, w.slug, i.id, i.role");
    expect(schemaSql).not.toContain("into matched_workspace, matched_invite");
    expect(schemaSql).toContain("where wm.workspace_id = matched_workspace_id");
    expect(schemaSql).toContain("raise exception 'You are already a member of this workspace.'");
    expect(schemaSql).toContain("values (matched_workspace_id, target_user_id, matched_invite_role)");
    expect(schemaSql).toContain("grant execute on function join_workspace_by_invite(text, text, uuid) to service_role");
  });

  it("exposes owner-only invite removal for cleanup", () => {
    expect(schemaSql).toContain("create policy workspace_invites_delete_owner");
    expect(actionsSource).toContain("deleteWorkspaceInviteAction");
    expect(actionsSource).toContain("await deleteWorkspaceInvite(");
  });

  it("caps workspace membership and enforces it in the join RPC", () => {
    expect(MAX_WORKSPACE_MEMBERS).toBe(20);
    // Hard backstop lives in Postgres so it holds even if the app check is raced.
    expect(schemaSql).toContain("raise exception 'Workspace member limit reached.'");
    expect(schemaSql).toContain("perform 1 from workspaces where id = matched_workspace_id for update");
  });

  it("caps outstanding invites and rate-limits invite creation", () => {
    expect(MAX_ACTIVE_WORKSPACE_INVITES).toBe(5);
    expect(actionsSource).toContain('scope: "invite_create_user_hour"');
  });

  it("persists the display-name change window on the profile", () => {
    expect(schemaSql).toContain("add column if not exists name_change_count integer not null default 0");
    expect(schemaSql).toContain("add column if not exists name_change_window_start timestamptz");
  });

  it("lets owners manage any invite but admins only their own", () => {
    const invite = { createdBy: "admin-1" } as WorkspaceInviteRecord;
    expect(canManageWorkspaceInvite("owner", "someone-else", invite)).toBe(true);
    expect(canManageWorkspaceInvite("admin", "admin-1", invite)).toBe(true);
    expect(canManageWorkspaceInvite("admin", "admin-2", invite)).toBe(false);
    expect(canManageWorkspaceInvite("requester", "admin-1", invite)).toBe(false);
    expect(canManageWorkspaceInvite("admin", "admin-1", {} as WorkspaceInviteRecord)).toBe(false);
  });

  it("defines owner-only cascading workspace deletion", () => {
    expect(schemaSql).toContain("create or replace function delete_workspace_as_owner");
    expect(schemaSql).toContain("and wm.role = 'owner'");
    expect(schemaSql).toContain("delete from workspaces w");
    expect(schemaSql).toContain("grant execute on function delete_workspace_as_owner(uuid, uuid) to service_role");
  });

  it("persists workspace selection and scopes legacy operations to the active workspace", () => {
    expect(authSource).toContain('const ACTIVE_WORKSPACE_COOKIE = "triagedesk_active_workspace"');
    expect(authSource).toContain("return { user, ...access };");
    // Switching a workspace runs the activate server action (not a client Link to
    // the route handler) so the cookie-driven root layout — header, sidebar, and
    // preview indicator — refreshes; the action busts the layout cache. The
    // /w/[slug] overview (Manage) is reached from the "Currently open" hub card.
    expect(workspaceOpenLinkSource).toContain("action={activateWorkspaceAction}");
    expect(actionsSource).toContain('revalidatePath("/", "layout")');
    expect(workspaceDashboardSource).toContain("href={`/w/${activeWorkspace.workspace.slug}`}");
    expect(workspaceDashboardSource).toContain("href={`/w/${activeWorkspace.workspace.slug}/activate`}");
    expect(actionsSource).toContain("const request = await createRequest(input, user, workspace.id)");
    expect(actionsSource).toContain("await createRequestAttachment(request.id, upload, workspace.id)");
    expect(actionsSource).toContain('await updateTicket(input, workspace.id, user?.displayName || "Admin", user?.id)');
    expect(ticketsSource).toContain("listTickets(filter, isAdmin ? undefined : userId, workspaceId)");
  });

  it("keeps the active workspace visible in the shell and workspace dashboard", () => {
    expect(appLayoutSource).toContain("Current ${activeWorkspace.isPreview ? \"preview \" : \"\"}workspace: ${activeWorkspace.name}");
    expect(appLayoutSource).toContain('{activeWorkspace?.name ?? "Choose workspace"}');
    expect(appLayoutSource).toContain('href="/onboarding"');
    expect(workspaceDashboardSource).toContain("Currently open");
    expect(workspaceDashboardSource).toContain("Requests, tickets, and settings are scoped to this workspace.");
    expect(workspaceOpenLinkSource).toContain("<Check size={14} /> Open");
    expect(workspaceOpenLinkSource).toContain('pendingText="Opening"');
  });

  it("shows workspace access policy without exposing seed configuration and keeps amber light-mode states readable", () => {
    expect(settingsSource).toContain("Invite only");
    expect(settingsSource).toContain("From invite");
    expect(settingsSource).toContain('isPreview ? "Locked in preview" : membership.role === "owner" ? "Requester or admin" : "Requester only"');
    expect(settingsSource).not.toContain("Signup default role");
    expect(settingsSource).not.toContain("Seed owner email");
    expect(settingsSource).not.toContain("getSeedAdminEmail");
    // Light theme redefines status hues to darker, WCAG-readable values via the
    // --st-* tokens (the design system replaced the old amber utility overrides
    // and data-accent presets with a live --accent picker + status tokens).
    expect(globalStylesSource).toContain('html[data-theme="light"]');
    expect(globalStylesSource).toContain("--st-warn: #b45309;");
    expect(globalStylesSource).toContain("--st-danger: #b91c1c;");
  });

  it("disables transition lag while dragging custom accent colors", () => {
    expect(themeControlsSource).toContain("document.documentElement.dataset.accentDragging = \"true\"");
    expect(themeControlsSource).toContain("delete document.documentElement.dataset.accentDragging");
    expect(themeControlsSource).toContain("onLostPointerCapture={endAccentDrag}");
    expect(globalStylesSource).toContain('html[data-accent-dragging="true"] *');
    expect(globalStylesSource).toContain("transition-duration: 0ms !important;");
    expect(globalStylesSource).toContain("transition-delay: 0ms !important;");
  });
});
