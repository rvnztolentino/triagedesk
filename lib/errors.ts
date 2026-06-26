// Shared, dependency-free error helpers usable from both server actions and
// client components. Keep this module free of server-only imports (next/headers,
// supabase, etc.) so client components can `import type { ActionState }` safely.

/** Standard return shape for server actions that surface failures inline. */
export type ActionState = { error?: string };

/**
 * Marks an error whose message is safe to show users verbatim (e.g. "Verify your
 * email before signing in."). Errors that are NOT PublicError are treated as
 * internal by `actionErrorMessage` and replaced with a generic message so DB or
 * infrastructure details never leak to the UI.
 */
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicError";
  }
}
