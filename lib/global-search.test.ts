import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Records every builder call so the test can assert how the query was scoped.
const calls: [string, ...unknown[]][] = [];
const builder: Record<string, unknown> = {};
for (const method of ["from", "select", "eq", "or", "order"]) {
  builder[method] = (...args: unknown[]) => {
    calls.push([method, ...args]);
    return builder;
  };
}
builder.limit = (...args: unknown[]) => {
  calls.push(["limit", ...args]);
  return Promise.resolve({
    data: [{ id: "TRG-1038", title: "Aircon leak", status: "in-progress", priority: "high", description: "not selected" }],
    error: null,
  });
};

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: () => builder,
  requireSupabaseAdminClient: () => builder,
  getRuntimeSetupStatus: () => ({ missing: [] }),
}));

const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  const end = source.indexOf("\nexport ", start + 1);
  return source.slice(start, end);
}

beforeEach(() => {
  calls.length = 0;
});

describe("searchTickets", () => {
  it("scopes to the workspace and returns only the palette fields", async () => {
    const { searchTickets } = await import("./store");
    const results = await searchTickets("aircon", undefined, "ws-1");

    expect(calls).toContainEqual(["from", "tickets"]);
    expect(calls).toContainEqual(["select", "id, title, status, priority"]);
    expect(calls).toContainEqual(["eq", "workspace_id", "ws-1"]);
    expect(calls).toContainEqual(["limit", 8]);
    expect(calls.some(([method, column]) => method === "eq" && column === "requester_user_id")).toBe(false);
    expect(results).toEqual([{ id: "TRG-1038", title: "Aircon leak", status: "in-progress", priority: "high" }]);
  });

  it("limits requesters to their own tickets", async () => {
    const { searchTickets } = await import("./store");
    await searchTickets("aircon", "user-7", "ws-1");

    expect(calls).toContainEqual(["eq", "requester_user_id", "user-7"]);
  });

  it("quotes the term inside the or() filter", async () => {
    const { searchTickets } = await import("./store");
    await searchTickets("aircon leak", undefined, "ws-1");

    const orFilter = calls.find(([method]) => method === "or")?.[1];
    expect(orFilter).toBe('id.ilike."%aircon leak%",title.ilike."%aircon leak%",description.ilike."%aircon leak%",location.ilike."%aircon leak%"');
  });
});

describe("searchWorkspaceAction guards", () => {
  it("checks origin, then the user, then the rate limit, then validates, then queries", () => {
    const body = functionBody(actionsSource, "searchWorkspaceAction");
    const order = [
      "requireTrustedActionRequest()",
      "getCurrentUser()",
      "getActiveWorkspaceAccess(",
      "enforceRateLimit(",
      "globalSearchQuerySchema.parse(",
      "searchTickets(",
    ].map((marker) => body.indexOf(marker));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
