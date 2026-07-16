// Small client-safe auth helpers shared by the Clerk-driven auth forms. Kept out
// of lib/auth.ts because that module imports server-only Clerk/Supabase APIs.

// Only allow same-site absolute paths as a post-auth redirect target, rejecting
// protocol-relative (`//host`) and backslash tricks. Mirrors sanitizeInternalRedirect
// in lib/auth.ts so client redirects can't be pointed off-site.
export function safeInternalNext(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : undefined;
}

// Reads a Clerk error code without importing Clerk's error types. Handles both the
// Signals API shape (a single ClerkError with `.code`) and the classic thrown
// ClerkAPIResponseError shape (`.errors[0].code`). Returns "" when neither matches.
export function clerkErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const single = (error as { code?: unknown }).code;
  if (typeof single === "string") return single;
  const errors = (error as { errors?: Array<{ code?: string }> }).errors;
  return errors?.[0]?.code ?? "";
}
