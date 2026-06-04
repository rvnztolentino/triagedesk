import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEmailVerificationRequired, getPostVerificationRedirect, roleForEmail, sanitizeInternalRedirect, validateLoginInput, validateSignupInput } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth role policy", () => {
  it("defaults new signups to requester", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "admin@triagedesk.test");

    expect(roleForEmail("teacher@triagedesk.test")).toBe("requester");
  });

  it("assigns owner only to the configured seed email", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "admin@triagedesk.test");

    expect(roleForEmail("ADMIN@triagedesk.test")).toBe("owner");
  });

  it("does not accept role input during signup validation", () => {
    const result = validateSignupInput({
      email: "requester@triagedesk.test",
      password: "password123",
      displayName: "Requester",
      role: "admin",
    });

    expect(result).toEqual({
      email: "requester@triagedesk.test",
      password: "password123",
      displayName: "Requester",
    });
  });

  it("validates login credentials without role data", () => {
    expect(() =>
      validateLoginInput({
        email: "requester@triagedesk.test",
        password: "password123",
      })
    ).not.toThrow();
  });

  it("rejects signup setups that return an immediate session", () => {
    expect(() => assertEmailVerificationRequired(true)).toThrow("Email confirmation must be enabled");
    expect(() => assertEmailVerificationRequired(false)).not.toThrow();
  });

  it("accepts internal next paths but rejects external redirect values", () => {
    expect(sanitizeInternalRedirect("/join/demo-clinic?code=DEMO-CLINIC-2026")).toBe("/join/demo-clinic?code=DEMO-CLINIC-2026");
    expect(sanitizeInternalRedirect("https://example.com")).toBeUndefined();
    expect(sanitizeInternalRedirect("//example.com")).toBeUndefined();
    expect(sanitizeInternalRedirect("/\\example.com")).toBeUndefined();
  });

  it("lands ordinary verification on the workspace dashboard while preserving explicit invite handoffs", () => {
    expect(getPostVerificationRedirect()).toBe("/onboarding");
    expect(getPostVerificationRedirect("/join/demo-clinic?code=DEMO-CLINIC-2026")).toBe("/join/demo-clinic?code=DEMO-CLINIC-2026");
  });
});
