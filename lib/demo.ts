import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AppUser } from "@/lib/schema";
import { requireSupabaseAdminClient } from "@/lib/supabase";
import { PublicError } from "@/lib/errors";
import { assertSameOriginRequest, enforceRateLimit, requestIdentity } from "@/lib/security";
import { captureOperationalError } from "@/lib/monitoring";

// Signed, HttpOnly cookie holding "<sessionId>.<hmac>". The signature is what stops a
// visitor from guessing or forging another visitor's session id and walking into their
// workspace. The id alone is the only thing standing between two demo sessions.
export const DEMO_SESSION_COOKIE = "td_demo_session";

// How long a demo workspace lives before the cleanup sweep removes it. Four hours,
// not twenty-four: a demo visit lasts minutes, and the write budget is per hour, so a
// long lifetime only widens the worst case for row growth without helping anyone.
// The RPC clamps this to 1-72h, so changing it needs no migration.
export const DEMO_LIFETIME_HOURS = 4;

// The cookie deliberately outlives the workspace. Expiry is enforced inside the
// signed token, so the extra hour grants no access at all; it just keeps the cookie
// in the jar long enough for the visitor to land on the expired screen instead of a
// bare sign-in page they have no account for.
const DEMO_COOKIE_GRACE_SECONDS = 60 * 60;

// Demo profiles use the RFC 2606 reserved .invalid TLD, so a demo email can never
// collide with a real Clerk signup no matter what a visitor types.
const DEMO_EMAIL_DOMAIN = "demo.invalid";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type SupabaseRow = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

// Server-only. Never expose this through a NEXT_PUBLIC_ variable: with the secret, a
// visitor could sign any session id and impersonate any demo workspace.
function demoSessionSecret() {
  return process.env.DEMO_SESSION_SECRET || "";
}

// The kill switch and the secret are checked together on purpose. A missing secret
// means signatures can't be trusted, so the demo must be off rather than unsigned:
// fail closed, not open.
export function isDemoEnabled() {
  if (process.env.DEMO_ENABLED === "false") return false;
  return demoSessionSecret().length > 0;
}

export function demoProfileEmail(sessionId: string) {
  return `demo-${sessionId}@${DEMO_EMAIL_DOMAIN}`;
}

export function isDemoEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

// The expiry is signed alongside the session id, so neither can be swapped without
// invalidating the other.
function signSessionPayload(sessionId: string, expiresAtSeconds: number) {
  return createHmac("sha256", demoSessionSecret()).update(`${sessionId}.${expiresAtSeconds}`).digest("hex");
}

export function createDemoSessionToken(sessionId: string, expiresAtSeconds: number) {
  return `${sessionId}.${expiresAtSeconds}.${signSessionPayload(sessionId, expiresAtSeconds)}`;
}

/**
 * Returns the session id only when the signature verifies and the token has not
 * expired. Anything malformed, tampered with, signed by a rotated secret, or past
 * its expiry resolves to undefined, which every caller treats as "signed out".
 *
 * The expiry lives in the token because cookie `maxAge` is a browser courtesy, not a
 * control: a scripted client keeps sending the cookie forever. Without this, a demo
 * session lasted until some unrelated visitor happened to trigger the opportunistic
 * cleanup sweep, which with no demo traffic is never.
 */
export function verifyDemoSessionToken(token: string | undefined, now = Date.now()): string | undefined {
  if (!token || !demoSessionSecret()) return undefined;

  const parts = token.split(".");
  if (parts.length !== 3) return undefined;

  const [sessionId, expiresAtRaw, signature] = parts;
  if (!UUID_PATTERN.test(sessionId)) return undefined;
  if (!/^\d{1,15}$/.test(expiresAtRaw)) return undefined;

  const expiresAtSeconds = Number(expiresAtRaw);
  const expected = Buffer.from(signSessionPayload(sessionId, expiresAtSeconds));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return undefined;
  // Signature first, so an expired-token check can never be used as an oracle
  // against a forged one.
  if (!timingSafeEqual(expected, provided)) return undefined;

  return expiresAtSeconds * 1000 > now ? sessionId : undefined;
}

export async function readDemoSessionId() {
  if (!isDemoEnabled()) return undefined;
  const cookieStore = await cookies();
  return verifyDemoSessionToken(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
}

// Presence, not validity. An expired or tampered cookie still means "this visitor
// came from a demo", which is what routes them to the expired screen rather than to
// a sign-in form for an account they never had.
export async function hasDemoSessionCookie() {
  if (!isDemoEnabled()) return false;
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
}

export async function setDemoSessionCookie(sessionId: string, expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    throw new Error("Create demo workspace failed: the database returned no usable expiry.");
  }

  const expiresAtSeconds = Math.floor(expiresAtMs / 1000);
  const secondsRemaining = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));

  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, createDemoSessionToken(sessionId, expiresAtSeconds), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: secondsRemaining + DEMO_COOKIE_GRACE_SECONDS,
  });
}

export async function clearDemoSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
}

// Resolves the demo principal for the current request, or null when there is no valid
// demo cookie. Called from getCurrentUser() only after Clerk has come back empty, so a
// signed-in user never pays for it, and a signed-out visitor with no demo cookie pays
// a cookie read and no database query at all.
export async function getDemoUser(): Promise<AppUser | null> {
  const sessionId = await readDemoSessionId();
  if (!sessionId) return null;

  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("user_profiles")
    .select("id, email, display_name, role, is_demo")
    .eq("email", demoProfileEmail(sessionId))
    .maybeSingle();
  if (error) throw new Error(`Get demo profile failed: ${error.message}`);

  const row = data as SupabaseRow | null;
  // The workspace expired and the sweep removed the profile: the cookie is stale, so
  // resolve to signed-out and let the UI offer a fresh demo.
  if (!row || row.is_demo !== true) return null;

  return {
    id: asString(row.id),
    email: asString(row.email),
    displayName: asString(row.display_name) || "Demo user",
    // A demo profile is always a plain requester at the account level; its powers come
    // from owning its own workspace, never from a platform-wide role.
    role: "requester",
    isDemo: true,
  };
}

// Four layers because each one alone is defeatable. The IP caps are the real ceiling
// (a cookie is trivially reset); the global cap is the budget guard that stops a
// runaway AI bill no matter how the other keys are spread.
async function enforceDemoCreateLimits() {
  const identity = await requestIdentity();
  await enforceRateLimit({
    scope: "demo_workspace_create_ip",
    keyParts: [identity.ip],
    limit: 3,
    windowSeconds: 60 * 60,
    message: "Too many demo workspaces from this network. Try again later.",
  });
  await enforceRateLimit({
    scope: "demo_workspace_create_global",
    keyParts: ["global"],
    limit: 200,
    windowSeconds: 24 * 60 * 60,
    message: "The live demo is busy right now. Please try again later.",
  });
}

// Per-visitor UX cap plus the IP and global ceilings behind it. Called from the triage
// path so demo traffic can never drain the Groq budget.
export async function enforceDemoTriageLimits(sessionId: string) {
  const identity = await requestIdentity();
  await enforceRateLimit({
    scope: "demo_triage_session",
    keyParts: [sessionId],
    limit: 5,
    windowSeconds: 60 * 60,
    message: "You've used the demo's triage limit for now. Sign up to keep going.",
  });
  await enforceRateLimit({
    scope: "demo_triage_ip",
    keyParts: [identity.ip],
    limit: 15,
    windowSeconds: 60 * 60,
    message: "Too many demo triage runs from this network. Try again later.",
  });
  await enforceRateLimit({
    scope: "demo_triage_global",
    keyParts: ["global"],
    limit: 500,
    windowSeconds: 24 * 60 * 60,
    message: "The live demo is busy right now. Please try again later.",
  });
}

// Bounds row growth from a demo session's ticket edits and notes.
export async function enforceDemoWriteLimit(sessionId: string) {
  await enforceRateLimit({
    scope: "demo_write_session",
    keyParts: [sessionId],
    limit: 60,
    windowSeconds: 60 * 60,
    message: "You're making changes too quickly. Try again in a moment.",
  });
}

export type DemoWorkspaceSession = {
  sessionId: string;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  expiresAt: string;
};

// Mints a demo session: rate-limit, clone the template in one transaction, then set
// the signed cookie. The cookie is written last on purpose: if the clone fails the
// visitor is left with no cookie at all rather than one pointing at nothing.
export async function startDemoSession(): Promise<DemoWorkspaceSession> {
  if (!isDemoEnabled()) {
    throw new PublicError("The live demo is unavailable right now.");
  }

  // Checked here rather than only in the calling action, so the demo entry point is
  // same-origin protected no matter who wires it up. This is the one endpoint an
  // anonymous visitor can reach that writes rows.
  await assertSameOriginRequest();
  await enforceDemoCreateLimits();

  const client = requireSupabaseAdminClient();
  const sessionId = randomUUID();
  const { data, error } = await client.rpc("create_demo_workspace", {
    target_session_id: sessionId,
    target_lifetime_hours: DEMO_LIFETIME_HOURS,
  });
  if (error) {
    captureOperationalError(error, { area: "demo_workspace_create", demo: true });
    throw new Error(`Create demo workspace failed: ${error.message}`);
  }

  const row = (data as SupabaseRow[] | null)?.[0];
  if (!row) throw new Error("Create demo workspace failed: the database returned no workspace.");

  // The expiry in the cookie is the one the database actually stored, which it clamps
  // to 1-72h. Signing that value rather than recomputing it means the token can never
  // outlive the workspace row it points at.
  const expiresAt = asString(row.workspace_expires_at);
  await setDemoSessionCookie(sessionId, expiresAt);

  return {
    sessionId,
    workspaceId: asString(row.workspace_id),
    workspaceSlug: asString(row.workspace_slug),
    userId: asString(row.demo_user_id),
    expiresAt,
  };
}

// A demo workspace is never handed to a real account. Signing up starts a fresh
// workspace of its own and the demo is left to expire, so there is no claim path and
// no ownership transfer anywhere in this module. Every piece of demo copy has to say
// the same thing, or the product is promising something it does not do.
