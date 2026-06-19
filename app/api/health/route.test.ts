import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/health", () => {
  it("redacts setup details in production without the healthcheck token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HEALTHCHECK_TOKEN", "secret");
    vi.stubEnv("GROQ_API_KEY", "");

    const response = GET(new Request("https://triagedesk.test/api/health"));
    const body = await response.json();

    expect(body.app).toBe("triagedesk");
    expect(body.missing).toBeUndefined();
    expect(body.groqConfigured).toBeUndefined();
  });

  it("returns setup details in production with the healthcheck token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HEALTHCHECK_TOKEN", "secret");
    vi.stubEnv("GROQ_API_KEY", "");

    const response = GET(new Request("https://triagedesk.test/api/health", {
      headers: { authorization: "Bearer secret" },
    }));
    const body = await response.json();

    expect(body.app).toBe("triagedesk");
    expect(body.missing).toContain("GROQ_API_KEY");
  });
});
