import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { triageConfidence, triageConfidenceInput } from "./confidence";

const reviewPage = readFileSync(new URL("../app/review/[id]/page.tsx", import.meta.url), "utf8");
const ticketPage = readFileSync(new URL("../app/tickets/[id]/page.tsx", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("./store.ts", import.meta.url), "utf8");

const triage = { requestId: "REQ-1042", department: "maintenance" as const, similarTicketIds: ["TRG-1001"] };

describe("triage confidence", () => {
  it("is deterministic for the same triage", () => {
    const input = triageConfidenceInput(triage);
    expect(triageConfidence(input.seed, input)).toEqual(triageConfidence(input.seed, input));
  });

  it("stays in the believable band and caps the similar-ticket nudge", () => {
    for (let i = 0; i < 200; i += 1) {
      const { value } = triageConfidence(`REQ-${i}:it`, { similarCount: 9 });
      expect(value).toBeGreaterThanOrEqual(0.72);
      expect(value).toBeLessThanOrEqual(0.97);
    }
  });

  it("depends only on the stored triage, not on the ticket an admin approved", () => {
    // An admin can change the department at approval, and the ticket gets its own id.
    // Neither is part of the input, so the score cannot move.
    const input = triageConfidenceInput(triage);
    expect(input).toEqual({ seed: "REQ-1042:maintenance", similarCount: 1 });
  });

  it("feeds both the review screen and the ticket screen from the stored triage", () => {
    expect(reviewPage).toContain("<ConfidenceMeter {...triageConfidenceInput(triage)} />");
    expect(ticketPage).toContain("seed={confidence.seed} similarCount={confidence.similarCount}");

    const detailSource = storeSource.slice(
      storeSource.indexOf("export async function getTicketDetail("),
      storeSource.indexOf("export async function getSimilarTickets("),
    );
    expect(detailSource).toContain("triageConfidenceInput(triage)");
  });
});
