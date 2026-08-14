import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AppUser } from "@/lib/schema";
import { requireSupabaseAdminClient } from "@/lib/supabase";
import { PublicError } from "@/lib/errors";
import { assertSameOriginRequest, enforceRateLimit, requestIdentity } from "@/lib/security";
import { captureOperationalError } from "@/lib/monitoring";

// Signed, HttpOnly cookie holding "<sessionId>.<hmac>". The signature is what stops a
// visitor from guessing or forging another visitor's session id and walking into their
// workspace — the id alone is the only thing standing between two demo sessions.
export const DEMO_SESSION_COOKIE = "td_demo_session";

// How long a demo workspace lives before the cleanup sweep removes it. The cookie is
// given the same lifetime so a stale cookie expires alongside the data it points at.
export const DEMO_LIFETIME_HOURS = 24;
const DEMO_COOKIE_MAX_AGE = DEMO_LIFETIME_HOURS * 60 * 60;

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
// means signatures can't be trusted, so the demo must be off rather than unsigned —
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

function signSessionId(sessionId: string) {
  return createHmac("sha256", demoSessionSecret()).update(sessionId).digest("hex");
}

export function createDemoSessionToken(sessionId: string) {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

// Returns the session id only when the signature verifies. Anything malformed,
// tampered with, or signed by a rotated secret resolves to undefined, which every
// caller treats as "signed out" rather than as an error.
export function verifyDemoSessionToken(token: string | undefined): string | undefined {
  if (!token || !demoSessionSecret()) return undefined;

  const parts = token.split(".");
  if (parts.length !== 2) return undefined;

  const [sessionId, signature] = parts;
  if (!UUID_PATTERN.test(sessionId)) return undefined;

  const expected = Buffer.from(signSessionId(sessionId));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length) return undefined;

  return timingSafeEqual(expected, provided) ? sessionId : undefined;
}

export async function readDemoSessionId() {
  if (!isDemoEnabled()) return undefined;
  const cookieStore = await cookies();
  return verifyDemoSessionToken(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
}

export async function setDemoSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, createDemoSessionToken(sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_COOKIE_MAX_AGE,
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
// the signed cookie. The cookie is written last on purpose — if the clone fails the
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

  await setDemoSessionCookie(sessionId);

  return {
    sessionId,
    workspaceId: asString(row.workspace_id),
    workspaceSlug: asString(row.workspace_slug),
    userId: asString(row.demo_user_id),
    expiresAt: asString(row.workspace_expires_at),
  };
}

// Hands the current demo workspace to a real, Clerk-backed profile so a visitor who
// signs up keeps the work they just did. Surfaces the workspace cap and the
// already-expired case as user-facing text; everything else stays generic.
export async function claimDemoWorkspace(profileId: string) {
  const sessionId = await readDemoSessionId();
  if (!sessionId) {
    throw new PublicError("This demo session has already ended.");
  }

  const client = requireSupabaseAdminClient();
  const { data, error } = await client.rpc("claim_demo_workspace", {
    target_session_id: sessionId,
    target_profile_id: profileId,
  });

  if (error) {
    if (error.message.includes("Workspace limit reached")) {
      throw new PublicError("You've reached your workspace limit, so this demo can't be kept.");
    }
    if (error.message.includes("already expired")) {
      throw new PublicError("This demo expired before it could be saved.");
    }
    if (error.message.includes("not found")) {
      throw new PublicError("This demo session has already ended.");
    }
    captureOperationalError(error, { area: "demo_workspace_claim", demo: true });
    throw new Error(`Claim demo workspace failed: ${error.message}`);
  }

  const row = (data as SupabaseRow[] | null)?.[0];
  if (!row) throw new PublicError("This demo session has already ended.");

  // The demo identity is gone once claimed; drop its cookie so the visitor resolves
  // as their real signed-in account from here on.
  await clearDemoSessionCookie();

  return { workspaceId: asString(row.workspace_id), workspaceSlug: asString(row.workspace_slug) };
}
