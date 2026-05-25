import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEmailVerificationRequired, roleForEmail, validateLoginInput, validateSignupInput } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth role policy", () => {
  it("defaults new signups to requester", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "admin@triagedesk.test");

    expect(roleForEmail("teacher@triagedesk.test")).toBe("requester");
  });

  it("assigns admin only to the configured seed admin email", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "admin@triagedesk.test");

    expect(roleForEmail("ADMIN@triagedesk.test")).toBe("admin");
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
});
