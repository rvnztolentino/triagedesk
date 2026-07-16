import { afterEach, describe, expect, it, vi } from "vitest";
import { getSeedAdminEmail, getPostVerificationRedirect, roleForEmail, sanitizeInternalRedirect } from "./auth";
import { clerkErrorCode, safeInternalNext } from "./auth-client";

// next/headers and Clerk's server helpers are only touched by functions that run
// inside a request; the pure helpers under test never call them. Stub next/headers
// defensively so importing the module stays side-effect free under vitest.
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("roleForEmail", () => {
  it("assigns owner to the configured seed admin (case-insensitive)", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "Owner@Example.com");
    expect(roleForEmail("owner@example.com")).toBe("owner");
    expect(roleForEmail("  OWNER@EXAMPLE.COM ")).toBe("owner");
  });

  it("assigns requester to everyone else", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "owner@example.com");
    expect(roleForEmail("someone@example.com")).toBe("requester");
  });

  it("assigns requester when no seed admin is configured", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "");
    expect(roleForEmail("owner@example.com")).toBe("requester");
  });
});

describe("getSeedAdminEmail", () => {
  it("normalizes the configured email", () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "  Admin@Example.com ");
    expect(getSeedAdminEmail()).toBe("admin@example.com");
  });
});

describe("sanitizeInternalRedirect", () => {
  it("accepts internal absolute paths", () => {
    expect(sanitizeInternalRedirect("/join/demo-clinic?code=DEMO")).toBe("/join/demo-clinic?code=DEMO");
  });

  it("rejects off-site, protocol-relative, and backslash targets", () => {
    expect(sanitizeInternalRedirect("https://evil.example.com")).toBeUndefined();
    expect(sanitizeInternalRedirect("//evil.example.com")).toBeUndefined();
    expect(sanitizeInternalRedirect("/\\evil")).toBeUndefined();
    expect(sanitizeInternalRedirect(undefined)).toBeUndefined();
  });
});

describe("getPostVerificationRedirect", () => {
  it("uses a safe next path when provided", () => {
    expect(getPostVerificationRedirect("/w/acme/tickets")).toBe("/w/acme/tickets");
  });

  it("falls back to onboarding for unsafe or missing next", () => {
    expect(getPostVerificationRedirect("https://evil.example.com")).toBe("/onboarding");
    expect(getPostVerificationRedirect(undefined)).toBe("/onboarding");
  });
});

describe("auth-client helpers", () => {
  it("safeInternalNext mirrors the server redirect guard", () => {
    expect(safeInternalNext("/onboarding")).toBe("/onboarding");
    expect(safeInternalNext("//evil.example.com")).toBeUndefined();
    expect(safeInternalNext("https://evil.example.com")).toBeUndefined();
    expect(safeInternalNext("/a\\b")).toBeUndefined();
    expect(safeInternalNext(undefined)).toBeUndefined();
  });

  it("clerkErrorCode reads the first error code, or empty string", () => {
    expect(clerkErrorCode({ errors: [{ code: "form_password_incorrect" }] })).toBe("form_password_incorrect");
    expect(clerkErrorCode({ errors: [] })).toBe("");
    expect(clerkErrorCode(new Error("boom"))).toBe("");
    expect(clerkErrorCode(null)).toBe("");
  });
});
