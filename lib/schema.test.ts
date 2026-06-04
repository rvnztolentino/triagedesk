import { describe, expect, it } from "vitest";
import { requestSubmissionSchema, triageDraftSchema, userRoleSchema, userRoleUpdateSchema, workspaceInviteCodeSchema, workspaceSlugSchema } from "./schema";

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
});
