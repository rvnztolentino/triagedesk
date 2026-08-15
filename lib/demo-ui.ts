// Client-safe half of the live demo. `lib/demo.ts` reaches for node:crypto and
// next/headers, so a client component can never import from it; anything the demo
// chrome needs in the browser (copy, countdown formatting) lives here instead.
// Keep this module free of server-only imports, the same rule `lib/errors.ts` follows.

// Every demo call to action lands on sign-up and returns to the workspace hub, where
// a new workspace is one form away. One constant so the banner, the blocked-action
// dialog, and the expired screen can never drift to different destinations.
export const DEMO_SIGNUP_HREF = "/signup?next=/onboarding";

export const DEMO_UPGRADE_TITLE = "Available on a real workspace";

// A demo workspace is never handed over to an account, so no copy anywhere may imply
// it is. Signing up is worth doing on its own terms: a workspace that lasts.
export const DEMO_UPGRADE_BODY =
  "This demo workspace is yours to explore, but account and sharing actions need a free account. Signing up starts you a workspace of your own that does not expire.";

// Stated in the banner rather than buried in a policy page: a demo workspace is
// throwaway by construction, so nobody should put anything real in one, and nobody
// should expect to get it back.
export const DEMO_PRIVACY_NOTE =
  "Nothing here is saved or carried over to an account. Don't put anything private in it.";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export function demoMillisRemaining(expiresAt: string | undefined, now = Date.now()) {
  if (!expiresAt) return undefined;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) ? expiry - now : undefined;
}

export function isDemoExpired(expiresAt: string | undefined, now = Date.now()) {
  const remaining = demoMillisRemaining(expiresAt, now);
  return remaining !== undefined && remaining <= 0;
}

// Deliberately coarse: the banner ticks once a minute, so second-level precision
// would only buy a number that is wrong between renders. An unparseable or missing
// expiry returns undefined so the caller can drop the countdown clause entirely
// rather than render "resets in NaN".
export function formatDemoRemaining(expiresAt: string | undefined, now = Date.now()) {
  const remaining = demoMillisRemaining(expiresAt, now);
  if (remaining === undefined) return undefined;
  if (remaining <= 0) return "any moment now";
  if (remaining < MINUTE_MS) return "under a minute";

  const hours = Math.floor(remaining / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
