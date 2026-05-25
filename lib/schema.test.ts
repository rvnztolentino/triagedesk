import { describe, expect, it } from "vitest";
import { requestSubmissionSchema, triageDraftSchema, userRoleSchema, userRoleUpdateSchema } from "./schema";

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
});
