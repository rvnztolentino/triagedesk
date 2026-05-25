import { departments, type SimilarTicket, triageDraftSchema, type TriageDraft, type RequestSubmission } from "@/lib/schema";
import { SetupRequiredError, getRuntimeSetupStatus } from "@/lib/supabase";

type TriageInput = RequestSubmission & {
  similarTickets?: SimilarTicket[];
};

const TEXT_LIMITS = {
  description: 1200,
  location: 160,
  urgencyNote: 400,
  similarTitle: 140,
  similarReason: 180,
};

const departmentLabels: Record<(typeof departments)[number], string> = {
  it: "IT",
  maintenance: "Maintenance",
  admin: "Admin",
  security: "Security",
  clinic: "Clinic",
  facilities: "Facilities",
};

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function pickDepartment(text: string): { department: TriageDraft["department"]; category: string; issue: string } {
  if (includesAny(text, ["badge", "keycard", "gate", "door", "lock", "intruder", "theft", "security", "turnstile"])) {
    return { department: "security", category: "Security", issue: "Access control" };
  }

  if (includesAny(text, ["wifi", "internet", "projector", "printer", "computer", "laptop", "password", "software", "network", "server"])) {
    return { department: "it", category: "IT", issue: "Technology" };
  }

  if (includesAny(text, ["patient", "clinic", "medicine", "nurse", "doctor", "injury", "medical", "pediatric"])) {
    return { department: "clinic", category: "Clinic", issue: "Clinical operations" };
  }

  if (includesAny(text, ["paper", "forms", "records", "schedule", "payroll", "office supplies", "document"])) {
    return { department: "admin", category: "Admin", issue: "Administrative support" };
  }

  if (includesAny(text, ["aircon", "air con", "ac ", "hvac", "leak", "water", "floor", "ceiling", "light", "restroom", "toilet", "elevator", "outlet"])) {
    return { department: "maintenance", category: "Maintenance", issue: "Facilities maintenance" };
  }

  return { department: "facilities", category: "Facilities", issue: "Operations support" };
}

function pickPriority(text: string): { priority: TriageDraft["priority"]; reason: string } {
  if (includesAny(text, ["fire", "smoke", "injury", "electric shock", "flood", "gas", "violence", "break-in"])) {
    return {
      priority: "critical",
      reason: "Potential safety or emergency impact requires immediate response.",
    };
  }

  if (includesAny(text, ["urgent", "wet floor", "leaking", "leak", "outage", "locked out", "exam", "patients", "multiple", "blocked", "entrance"])) {
    return {
      priority: "high",
      reason: "The request may disrupt operations or create a safety risk if not handled quickly.",
    };
  }

  if (includesAny(text, ["broken", "not working", "warm", "error", "failed", "dim", "slow"])) {
    return {
      priority: "medium",
      reason: "The issue affects normal work but does not indicate immediate safety risk.",
    };
  }

  return {
    priority: "low",
    reason: "The request appears routine and can be handled in the normal queue.",
  };
}

function createTitle(issue: string, location: string, text: string) {
  const normalizedLocation = location.trim();

  if (includesAny(text, ["aircon", "air con", "ac ", "hvac"])) {
    return `HVAC issue at ${normalizedLocation}`;
  }

  if (includesAny(text, ["leak", "water", "wet floor", "flood"])) {
    return `Water leak at ${normalizedLocation}`;
  }

  if (includesAny(text, ["projector"])) {
    return `Projector issue at ${normalizedLocation}`;
  }

  if (includesAny(text, ["badge", "keycard", "gate", "turnstile"])) {
    return `Access issue at ${normalizedLocation}`;
  }

  return `${issue} request at ${normalizedLocation}`;
}

function clipText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

export function buildTriagePromptPayload(input: TriageInput) {
  return {
    request: {
      description: clipText(input.description, TEXT_LIMITS.description),
      location: clipText(input.location, TEXT_LIMITS.location),
      urgencyNote: clipText(input.urgencyNote, TEXT_LIMITS.urgencyNote),
    },
    similarTickets: (input.similarTickets ?? []).slice(0, 3).map((ticket) => ({
      id: ticket.id,
      title: clipText(ticket.title, TEXT_LIMITS.similarTitle),
      status: ticket.status,
      priority: ticket.priority,
      department: ticket.department,
      reason: clipText(ticket.reason, TEXT_LIMITS.similarReason),
    })),
  };
}

export function rulesTriage(input: TriageInput): TriageDraft {
  const combinedText = `${input.description} ${input.location} ${input.urgencyNote}`.toLowerCase();
  const classification = pickDepartment(combinedText);
  const priority = pickPriority(combinedText);
  const similarTicketIds = (input.similarTickets ?? []).slice(0, 3).map((ticket) => ticket.id);
  const title = createTitle(classification.issue, input.location, combinedText);
  const departmentName = departmentLabels[classification.department];

  return triageDraftSchema.parse({
    source: "rules",
    title,
    category: classification.category,
    priority: priority.priority,
    department: classification.department,
    summary: `${departmentName} should review ${input.location}. ${input.description.trim()}`,
    priorityReasoning: priority.reason,
    similarTicketIds,
  });
}

async function groqTriage(input: TriageInput): Promise<TriageDraft> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You triage internal operations requests for a small organization.",
            "Return only JSON with source, title, category, priority, department, summary, priorityReasoning, and similarTicketIds.",
            "priority must be low, medium, high, or critical.",
            "department must be one of it, maintenance, admin, security, clinic, facilities.",
            "Keep summary and priorityReasoning concise.",
            "Use only the provided similar ticket IDs in similarTicketIds.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(buildTriagePromptPayload(input)),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI triage failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI triage returned an empty response.");
  }

  return triageDraftSchema.parse({
    ...JSON.parse(content),
    source: "groq",
  });
}

export async function runTriage(input: TriageInput): Promise<TriageDraft> {
  const setup = getRuntimeSetupStatus();

  if (!setup.groqConfigured) {
    const missing = setup.missing.filter((item) => item === "AI_PROVIDER=groq" || item === "GROQ_API_KEY");
    throw new SetupRequiredError("AI triage is not configured. Complete setup before submitting requests.", missing);
  }

  return groqTriage(input);
}
