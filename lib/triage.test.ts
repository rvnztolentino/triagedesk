import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTriagePromptPayload, rulesTriage, runTriage } from "./triage";

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseRequest = {
  description: "Aircon in Room 304 is leaking again. Floor is wet near the outlet.",
  location: "Building A, Room 304",
  contactName: "",
  urgencyNote: "",
  similarTickets: [],
};

const validDraft = {
  title: "Water leak at Room 304",
  category: "Maintenance",
  priority: "high",
  department: "maintenance",
  summary: "Maintenance should inspect the leaking aircon.",
  priorityReasoning: "Wet floors can create a safety risk.",
  similarTicketIds: [],
};

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

  it("routes an unauthorized person to security even when the request names equipment", () => {
    const result = rulesTriage({
      description: "There is a stranger using the computer in here.",
      location: "Building C, Room 89",
      contactName: "",
      urgencyNote: "",
      similarTickets: [],
    });

    expect(result.department).toBe("security");
    expect(result.priority).toBe("high");
  });

  it("does not match keywords inside unrelated words", () => {
    const result = rulesTriage({
      description: "Requesting a replacement gasket for the pantry sink tap.",
      location: "Building A, Pantry",
      contactName: "",
      urgencyNote: "",
      similarTickets: [],
    });

    // "gas" must not match inside "gasket" and escalate this to critical.
    expect(result.priority).not.toBe("critical");
  });

  it("gives the model enough completion budget for reasoning plus JSON", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validDraft) } }] }), { status: 200 })
    );

    await runTriage(baseRequest);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(1500);
    expect(body.reasoning_effort).toBe("low");
    fetchMock.mockRestore();
  });

  it("retries when Groq rejects a truncated generation instead of falling back", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "json_validate_failed", message: "Failed to validate JSON." } }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validDraft) } }] }), { status: 200 })
      );

    const result = await runTriage(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("groq");
    fetchMock.mockRestore();
  });

  it("drops reasoning_effort for models that reject it", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "llama-3.1-8b-instant");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: "`reasoning_effort` is not supported with this model" } }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validDraft) } }] }), { status: 200 })
      );

    const result = await runTriage(baseRequest);

    const retryBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect("reasoning_effort" in retryBody).toBe(false);
    expect(result.source).toBe("groq");
    fetchMock.mockRestore();
  });

  it("stops retrying on an unusable API key", async () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "bad-key");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ error: { code: "invalid_api_key" } }), { status: 401 }));

    const result = await runTriage(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("rules");
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
