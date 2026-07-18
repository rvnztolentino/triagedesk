import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTriagePromptPayload, rulesTriage, runTriage } from "./triage";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rulesTriage", () => {
  it("classifies leaking aircon requests as high-priority maintenance", () => {
    const result = rulesTriage({
      description: "Aircon in Room 304 is leaking again. Floor is wet near the outlet.",
      location: "Building A, Room 304",
      contactName: "",
      urgencyNote: "",
      similarTickets: [],
    });

    expect(result.source).toBe("rules");
    expect(result.department).toBe("maintenance");
    expect(result.priority).toBe("high");
    expect(result.title).toContain("Building A, Room 304");
  });

  it("classifies keycard failures as security", () => {
    const result = rulesTriage({
      description: "Several staff badges are failing at the east gate turnstile.",
      location: "East Gate",
      contactName: "Security Desk",
      urgencyNote: "Entrance is backed up.",
      similarTickets: [],
    });

    expect(result.department).toBe("security");
    expect(result.priority).toBe("high");
  });

  it("never leaves safety-hazard requests in the routine queue", () => {
    const result = rulesTriage({
      description: "A ceiling tile near the elevator is sagging and might fall.",
      location: "Building A, Room F705",
      contactName: "",
      urgencyNote: "",
      similarTickets: [],
    });

    expect(result.priority).toBe("high");
    expect(result.priorityReasoning).toContain("safety-hazard");
  });

  it("does not escalate vague requests without hazard language", () => {
    const result = rulesTriage({
      description: "help im stuck bro",
      location: "",
      contactName: "",
      urgencyNote: "",
      similarTickets: [],
    });

    expect(result.priority).toBe("low");
  });

  it("floors AI-returned low priority when the request describes a hazard", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Sagging ceiling tile near elevator",
                  category: "Maintenance",
                  priority: "low",
                  department: "maintenance",
                  summary: "Maintenance should review the ceiling tile.",
                  priorityReasoning: "The request appears routine.",
                  similarTicketIds: [],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await runTriage({
      description: "A ceiling tile near the elevator is sagging and might fall.",
      location: "Building A, Room F705",
      contactName: "",
      urgencyNote: "",
      similarTickets: [],
    });

    expect(result.source).toBe("groq");
    expect(result.priority).toBe("high");
    fetchMock.mockRestore();
  });

  it("requires Groq configuration for runtime triage", async () => {
    vi.stubEnv("AI_PROVIDER", "rules");
    vi.stubEnv("GROQ_API_KEY", "");

    await expect(
      runTriage({
        description: "Aircon in Room 304 is leaking again. Floor is wet near the outlet.",
        location: "Building A, Room 304",
        contactName: "",
        urgencyNote: "",
        similarTickets: [],
      })
    ).rejects.toThrow("AI triage is not configured");
  });

  it("falls back to rules triage when Groq times out or fails", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network timeout"));

    const result = await runTriage({
      description: "Aircon in Room 304 is leaking again. Floor is wet near the outlet.",
      location: "Building A, Room 304",
      contactName: "",
      urgencyNote: "",
      similarTickets: [],
    });

    expect(result.source).toBe("rules");
    expect(result.department).toBe("maintenance");
    fetchMock.mockRestore();
  });

  it("filters model-returned similar ticket ids to provided candidates", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Water leak at Room 304",
                  category: "Maintenance",
                  priority: "high",
                  department: "maintenance",
                  summary: "Maintenance should inspect the leak.",
                  priorityReasoning: "Wet floors can create a safety risk.",
                  similarTicketIds: ["TRG-1", "TRG-secret"],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await runTriage({
      description: "Aircon in Room 304 is leaking again. Floor is wet near the outlet.",
      location: "Building A, Room 304",
      contactName: "",
      urgencyNote: "",
      similarTickets: [
        { id: "TRG-1", title: "Leak", status: "open", priority: "high", department: "maintenance", reason: "same room" },
      ],
    });

    expect(result.source).toBe("groq");
    expect(result.similarTicketIds).toEqual(["TRG-1"]);
    fetchMock.mockRestore();
  });

  it("keeps runtime AI context minimal", () => {
    const payload = buildTriagePromptPayload({
      description: "A".repeat(1400),
      location: "Building A, Room 304",
      contactName: "Requester Name",
      urgencyNote: "B".repeat(600),
      similarTickets: [
        { id: "TRG-1", title: "First", status: "open", priority: "high", department: "maintenance", reason: "same room" },
        { id: "TRG-2", title: "Second", status: "open", priority: "medium", department: "it", reason: "matching words" },
        { id: "TRG-3", title: "Third", status: "closed", priority: "low", department: "admin", reason: "old match" },
        { id: "TRG-4", title: "Fourth", status: "closed", priority: "low", department: "admin", reason: "should not be sent" },
      ],
    });

    expect(payload.request.description.length).toBeLessThanOrEqual(1200);
    expect(payload.request.urgencyNote.length).toBeLessThanOrEqual(400);
    expect("contactName" in payload.request).toBe(false);
    expect(payload.similarTickets).toHaveLength(3);
    expect(payload.similarTickets.map((ticket) => ticket.id)).toEqual(["TRG-1", "TRG-2", "TRG-3"]);
  });
});
