// Small client-safe auth helpers shared by the Clerk-driven auth forms. Kept out
// of lib/auth.ts because that module imports server-only Clerk/Supabase APIs.

// Only allow same-site absolute paths as a post-auth redirect target, rejecting
// protocol-relative (`//host`) and backslash tricks. Mirrors sanitizeInternalRedirect
// in lib/auth.ts so client redirects can't be pointed off-site.
export function safeInternalNext(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : undefined;
}

// Cooldown, in seconds, the user must wait between verification-code sends. Applied
// both on first arrival at the check-email page (a code was just sent by sign-up) and
// after every resend, so the "Resend code" control can't be used to email-bomb an
// address. Clerk also rate-limits the underlying send server-side; this is the UX gate.
export const RESEND_COOLDOWN_SECONDS = 120;

// Formats a remaining-seconds countdown as m:ss (e.g. 120 -> "2:00", 9 -> "0:09").
// Negative or non-finite inputs clamp to "0:00".
export function formatResendCountdown(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
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

// Reads a human-readable message from a Clerk error, preferring the long-form
// `message` and falling back to the short `longMessage`/`message` fields on both
// the Signals API and classic ClerkAPIResponseError shapes. Returns "" when none
// is present, so callers can fall back to their own generic copy.
export function clerkErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const first = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0];
  const candidate =
    first?.longMessage ??
    first?.message ??
    (error as { longMessage?: string; message?: string }).longMessage ??
    (error as { message?: string }).message;
  return typeof candidate === "string" ? candidate.trim() : "";
}
