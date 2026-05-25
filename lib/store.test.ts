import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase store setup detection", () => {
  it("returns setup-required dashboard data when Supabase and Groq are not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("AI_PROVIDER", "rules");
    vi.stubEnv("GROQ_API_KEY", "");

    const { getDashboardData, listDepartments } = await import("./store");
    const dashboard = await getDashboardData();
    const departments = await listDepartments();

    expect(dashboard.setupRequired).toEqual(
      expect.arrayContaining(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AI_PROVIDER=groq", "GROQ_API_KEY"])
    );
    expect(dashboard.counts.openTickets).toBe(0);
    expect(departments.map((department) => department.id)).toContain("maintenance");
  });
});
