import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEmailVerificationRequired, getGoogleOAuthUrl, getPostVerificationRedirect, isExistingUserSignupError, roleForEmail, sanitizeInternalRedirect, signUpWithEmail, validateLoginInput, validateSignupInput } from "./auth";
import { RateLimitError } from "@/lib/security";

const signInWithOAuth = vi.fn();
const signUp = vi.fn();

vi.mock("@/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase")>();
  return {
    ...actual,
    requireSupabaseOAuthClient: () => ({ auth: { signInWithOAuth } }),
    requireSupabaseAuthClient: () => ({ auth: { signUp } }),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  signInWithOAuth.mockReset();
  signUp.mockReset();
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

describe("google oauth", () => {
  it("requests Google with a fixed callback and round-trips a sanitized internal next", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://triagedesk.test");
    signInWithOAuth.mockResolvedValue({ data: { url: "https://supabase.test/authorize?provider=google" }, error: null });

    const url = await getGoogleOAuthUrl("/join/demo-clinic?code=DEMO-CLINIC-2026");

    expect(url).toBe("https://supabase.test/authorize?provider=google");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://triagedesk.test/auth/callback?next=%2Fjoin%2Fdemo-clinic%3Fcode%3DDEMO-CLINIC-2026",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("drops an external next so the OAuth callback cannot become an open redirect", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://triagedesk.test");
    signInWithOAuth.mockResolvedValue({ data: { url: "https://supabase.test/authorize" }, error: null });

    await getGoogleOAuthUrl("https://evil.example.com");

    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ redirectTo: "https://triagedesk.test/auth/callback" }),
      })
    );
  });

  it("surfaces a user-facing error when the provider URL cannot be built", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "provider disabled" } });

    await expect(getGoogleOAuthUrl()).rejects.toThrow("provider disabled");
  });
});

describe("signup account enumeration", () => {
  it("recognizes existing-user signup errors by code or message", () => {
    expect(isExistingUserSignupError({ code: "user_already_exists" })).toBe(true);
    expect(isExistingUserSignupError({ code: "email_exists" })).toBe(true);
    expect(isExistingUserSignupError({ message: "User already registered" })).toBe(true);
    expect(isExistingUserSignupError({ message: "Password should be at least 8 characters" })).toBe(false);
    expect(isExistingUserSignupError(null)).toBe(false);
  });

  it("swallows existing-account errors and returns the neutral verification outcome", async () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "admin@triagedesk.test");
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "user_already_exists", message: "User already registered" } });

    await expect(
      signUpWithEmail({ email: "existing@triagedesk.test", password: "password123", displayName: "Existing" })
    ).resolves.toEqual({ email: "existing@triagedesk.test", needsVerification: true });
  });

  it("still surfaces genuine signup failures", async () => {
    vi.stubEnv("SEED_ADMIN_EMAIL", "admin@triagedesk.test");
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "over_email_send_rate_limit", message: "Email rate limit exceeded" } });

    // Unlike existing-account errors, real throttling is surfaced (not swallowed)
    // — as a RateLimitError so the signup page can steer users to Google.
    await expect(
      signUpWithEmail({ email: "new@triagedesk.test", password: "password123", displayName: "New" })
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
