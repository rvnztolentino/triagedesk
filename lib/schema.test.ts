import { describe, expect, it } from "vitest";
import { requestSubmissionSchema, triageDraftSchema } from "./schema";

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
});
