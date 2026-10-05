import { describe, expect, it } from "vitest";
import { globalSearchQuerySchema, requestSubmissionSchema, ticketUpdateSchema, triageDraftSchema, userRoleSchema, userRoleUpdateSchema, workspaceInviteCodeSchema, workspaceNameSchema, workspaceSlugSchema } from "./schema";

describe("schemas", () => {
  it("rejects empty request details", () => {
    const result = requestSubmissionSchema.safeParse({
      description: "",
      location: "",
      contactName: "",
      urgencyNote: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a request with only a description", () => {
    const result = requestSubmissionSchema.safeParse({ description: "The hallway light is flickering." });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ location: "", contactName: "", urgencyNote: "" });
  });

  it("caps request text fields to protect storage and AI context", () => {
    expect(
      requestSubmissionSchema.safeParse({
        description: "A".repeat(1201),
        location: "Front desk",
        contactName: "",
        urgencyNote: "",
      }).success
    ).toBe(false);
    expect(
      requestSubmissionSchema.safeParse({
        description: "The ceiling is leaking above the intake counter.",
        location: "A".repeat(161),
        contactName: "",
        urgencyNote: "",
      }).success
    ).toBe(false);
  });

  it("accepts a normal workspace name but rejects profane ones", () => {
    expect(workspaceNameSchema.safeParse("Northside Clinic").success).toBe(true);
    expect(workspaceNameSchema.safeParse("f").success).toBe(false);
    expect(workspaceNameSchema.safeParse("fuck clinic").success).toBe(false);
  });

  it("accepts valid rules triage output", () => {
    const result = triageDraftSchema.safeParse({
      source: "rules",
      title: "Water leak at Room 304",
      category: "Maintenance",
      priority: "high",
      department: "maintenance",
      summary: "Maintenance should inspect the room and stop the leak.",
      priorityReasoning: "Wet floors can create a safety risk.",
      similarTicketIds: [],
    });

    expect(result.success).toBe(true);
  });

  it("stores owner as a valid role but blocks manual owner assignment", () => {
    const storedRole = userRoleSchema.safeParse("owner");
    const manualUpdate = userRoleUpdateSchema.safeParse({
      userId: "11111111-1111-4111-8111-111111111111",
      role: "owner",
    });

    expect(storedRole.success).toBe(true);
    expect(manualUpdate.success).toBe(false);
  });

  it("accepts centralized workspace slugs and rejects URL-unsafe values", () => {
    expect(workspaceSlugSchema.safeParse("demo-clinic").success).toBe(true);
    expect(workspaceSlugSchema.safeParse("Demo Clinic").success).toBe(false);
    expect(workspaceSlugSchema.safeParse("demo--school").success).toBe(false);
  });

  it("accepts invite codes but rejects malformed input", () => {
    expect(workspaceInviteCodeSchema.safeParse("DEMO-CLINIC-2026").success).toBe(true);
    expect(workspaceInviteCodeSchema.safeParse("demo school").success).toBe(false);
    expect(workspaceInviteCodeSchema.safeParse("demo--school").success).toBe(false);
  });

  it("strips PostgREST filter syntax and wildcards from global search terms", () => {
    expect(globalSearchQuerySchema.parse("  TRG-1038  ")).toBe("TRG-1038");
    expect(globalSearchQuerySchema.parse("leak),workspace_id.neq.x")).toBe("leak workspace id neq x");
    expect(globalSearchQuerySchema.parse('%_*"aircon"')).toBe("aircon");
    expect(globalSearchQuerySchema.parse("Café  ñ")).toBe("Café ñ");
    expect(globalSearchQuerySchema.parse("x".repeat(150))).toHaveLength(80);
  });

  it("rejects global search terms with fewer than two usable characters", () => {
    expect(globalSearchQuerySchema.safeParse("a").success).toBe(false);
    expect(globalSearchQuerySchema.safeParse("%%%").success).toBe(false);
    expect(globalSearchQuerySchema.safeParse("x".repeat(201)).success).toBe(false);
  });

  it("requires a known priority on ticket updates", () => {
    const update = { ticketId: "TRG-1001", status: "open", department: "it" };

    expect(ticketUpdateSchema.safeParse({ ...update, priority: "critical" }).success).toBe(true);
    expect(ticketUpdateSchema.safeParse(update).success).toBe(false);
    expect(ticketUpdateSchema.safeParse({ ...update, priority: "urgent" }).success).toBe(false);
  });

  it("treats an empty assignee as unassigned and rejects anything that is not a user id", () => {
    const update = { ticketId: "TRG-1001", status: "open", priority: "high", department: "it" };
    const userId = "33333333-3333-4333-8333-333333333333";

    expect(ticketUpdateSchema.parse(update).assigneeUserId).toBe("");
    expect(ticketUpdateSchema.parse({ ...update, assigneeUserId: "" }).assigneeUserId).toBe("");
    expect(ticketUpdateSchema.parse({ ...update, assigneeUserId: userId }).assigneeUserId).toBe(userId);
    expect(ticketUpdateSchema.safeParse({ ...update, assigneeUserId: "ana@example.com" }).success).toBe(false);
  });
});
