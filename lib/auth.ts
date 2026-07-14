import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { authCredentialsSchema, loginCredentialsSchema, workspaceSlugSchema, type AppUser, type AuthCredentials, type UserProfileRecord, type UserRole } from "@/lib/schema";
import { getSupabaseAdminClient, getSupabaseAuthClient, getRuntimeSetupStatus, requireSupabaseAdminClient, requireSupabaseAuthClient, requireSupabaseOAuthClient, SetupRequiredError } from "@/lib/supabase";
import { PublicError } from "@/lib/errors";
import { RateLimitError } from "@/lib/security";
import { assertCleanDisplayName, addMonths, nameChangeStatus, NAME_CHANGE_WINDOW_MONTHS } from "@/lib/display-name";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { countOwnedWorkspaces, getPostAuthWorkspacePath, isWorkspaceAdmin, isWorkspacePreview, requireWorkspaceMembership } from "@/lib/workspaces";

const ACCESS_COOKIE = "triagedesk_access_token";
const REFRESH_COOKIE = "triagedesk_refresh_token";
// Keep users signed in for a week. The access-token JWT still expires hourly, so
// middleware.ts silently rotates it via the refresh token on each request within
// this window (see setSessionCookies / SESSION_COOKIE_OPTIONS).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const PASSWORD_RESET_COOKIE = "triagedesk_pending_auth";
const ACTIVE_WORKSPACE_COOKIE = "triagedesk_active_workspace";

type ProfileRow = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// OAuth providers (Google) carry the user's name in different metadata keys than
// our email signup, which sets `display_name`. Fall back across the common keys so
// social sign-ins get a real name instead of the email prefix.
function displayNameFromMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) return "";
  return asString(metadata.display_name) || asString(metadata.full_name) || asString(metadata.name);
}

export function getSeedAdminEmail() {
  return normalizeEmail(process.env.SEED_ADMIN_EMAIL || "");
}

export function roleForEmail(email: string): UserRole {
  const seedAdminEmail = getSeedAdminEmail();
  return seedAdminEmail && normalizeEmail(email) === seedAdminEmail ? "owner" : "requester";
}

export function assertEmailVerificationRequired(hasImmediateSession: boolean) {
  if (hasImmediateSession) {
    throw new SetupRequiredError("Email confirmation must be enabled before signup.", ["Supabase Auth Confirm email"]);
  }
}

// Detects Supabase's "this email already has an account" signup result so we can
// swallow it and return the same generic response a brand-new signup gets. Surfacing
// it would let anyone probe the signup form to learn which emails are registered
// (account enumeration). Supabase already obfuscates this when enumeration
// protection is on, but the setting is project-configurable, so we never rely on it.
export function isExistingUserSignupError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "user_already_exists" || code === "email_exists" || /already\s+(registered|exists|in use)/i.test(message);
}

// Supabase returns a single generic "invalid credentials" error for both a wrong
// password and an unknown email. We re-check the profile table to distinguish them.
function isInvalidCredentialsError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "invalid_credentials" || /invalid login credentials/i.test(message);
}

function isEmailNotConfirmedError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "email_not_confirmed" || /email not confirmed/i.test(message);
}

// Detects Supabase's own throttling on signup: the confirmation-email send rate
// limit and the generic auth request rate limit (both surface as HTTP 429). These
// are separate from our per-IP app limit, and Google sign-up sidesteps them
// entirely (no confirmation email), so callers can steer users to Google instead.
export function isSupabaseRateLimitError(error: { message?: string; code?: string; status?: number } | null | undefined) {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    error.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    /rate limit|too many requests/i.test(message)
  );
}

function profileFromRow(row: ProfileRow): UserProfileRecord {
  const role = asString(row.role);
  return {
    id: asString(row.id),
    email: asString(row.email),
    displayName: asString(row.display_name),
    role: role === "owner" || role === "admin" ? role : "requester",
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    nameChangeCount: typeof row.name_change_count === "number" ? row.name_change_count : Number(row.name_change_count ?? 0) || 0,
    nameChangeWindowStart: row.name_change_window_start ? asString(row.name_change_window_start) : undefined,
  };
}

function toAppUser(profile: UserProfileRecord): AppUser {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName || profile.email.split("@")[0],
    role: profile.role,
  };
}

function isSeedOwnerEmail(email: string) {
  const seedAdminEmail = getSeedAdminEmail();
  return Boolean(seedAdminEmail && normalizeEmail(email) === seedAdminEmail);
}

async function ensureSeedOwnerProfile(profile: UserProfileRecord) {
  if (isSeedOwnerEmail(profile.email) && profile.role !== "owner") {
    return upsertUserProfile({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      role: "owner",
    });
  }

  return profile;
}

async function setSessionCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
  cookieStore.set(ACCESS_COOKIE, accessToken, options);
  cookieStore.set(REFRESH_COOKIE, refreshToken, options);
}

async function completeVerifiedSession(input: {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> | null };
  accessToken: string;
  refreshToken: string;
}) {
  if (!input.user.email) {
    throw new Error("Email verification failed.");
  }

  const profile = await upsertUserProfile({
    id: input.user.id,
    email: input.user.email,
    displayName: displayNameFromMetadata(input.user.user_metadata),
    role: roleForEmail(input.user.email),
  });
  await setSessionCookies(input.accessToken, input.refreshToken);
  return toAppUser(profile);
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  cookieStore.delete(PASSWORD_RESET_COOKIE);
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

export function validateSignupInput(input: unknown) {
  return authCredentialsSchema.parse(input);
}

export function validateLoginInput(input: unknown) {
  return loginCredentialsSchema.parse(input);
}

export async function upsertUserProfile(input: { id: string; email: string; displayName?: string; role?: UserRole }) {
  const client = requireSupabaseAdminClient();
  const timestamp = new Date().toISOString();
  const role = input.role ?? roleForEmail(input.email);
  const displayName = input.displayName?.trim() || input.email.split("@")[0];
  const { data, error } = await client
    .from("user_profiles")
    .upsert(
      {
        id: input.id,
        email: normalizeEmail(input.email),
        display_name: displayName,
        role,
        updated_at: timestamp,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Save user profile failed: ${error.message}`);
  }

  return profileFromRow(data as ProfileRow);
}

export async function getUserProfile(userId: string) {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  const { data, error } = await client.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    throw new Error(`Get user profile failed: ${error.message}`);
  }

  return data ? profileFromRow(data as ProfileRow) : undefined;
}

// Looks up a profile by email. Used at sign-in to tell "no such account" apart
// from "wrong password" so the form can show a specific message.
export async function getUserProfileByEmail(email: string) {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  const { data, error } = await client.from("user_profiles").select("*").eq("email", normalizeEmail(email)).maybeSingle();
  if (error) {
    throw new Error(`Get user profile failed: ${error.message}`);
  }

  return data ? profileFromRow(data as ProfileRow) : undefined;
}

function formatResetDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Updates the signed-in user's display name after running it through the shared
// name filter (length, character set, links, profanity) and the change-rate limit
// (max MAX_NAME_CHANGES per rolling NAME_CHANGE_WINDOW_MONTHS). Saving the same name
// is a no-op that doesn't consume an allowance. Throws PublicError with a specific
// reason when the name is rejected or the limit is reached.
export async function updateDisplayName(userId: string, rawName: string) {
  const displayName = assertCleanDisplayName(rawName);
  const client = requireSupabaseAdminClient();

  const { data: current, error: fetchError } = await client
    .from("user_profiles")
    .select("display_name, name_change_count, name_change_window_start")
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) {
    throw new Error(`Update display name failed: ${fetchError.message}`);
  }
  if (!current) {
    throw new PublicError("Your profile could not be found.");
  }

  const row = current as ProfileRow;
  // No-op: same name shouldn't burn a change. Return the existing profile as-is.
  if (asString(row.display_name) === displayName) {
    return profileFromRow(row);
  }

  const now = new Date();
  const storedCount = typeof row.name_change_count === "number" ? row.name_change_count : Number(row.name_change_count ?? 0) || 0;
  const storedWindowStart = row.name_change_window_start ? asString(row.name_change_window_start) : undefined;
  const status = nameChangeStatus(storedCount, storedWindowStart, now);

  if (status.remaining <= 0) {
    const resetAt = status.resetAt ?? addMonths(now, NAME_CHANGE_WINDOW_MONTHS);
    throw new PublicError(`You've used both of your name changes for now. You can change your name again on ${formatResetDate(resetAt)}.`);
  }

  // A fresh window (first-ever change or the previous window elapsed) starts now;
  // otherwise keep counting within the active window.
  const windowStart = status.used === 0 ? now.toISOString() : (storedWindowStart as string);
  const nextCount = status.used + 1;

  const { data, error } = await client
    .from("user_profiles")
    .update({
      display_name: displayName,
      name_change_count: nextCount,
      name_change_window_start: windowStart,
      updated_at: now.toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Update display name failed: ${error.message}`);
  }

  return profileFromRow(data as ProfileRow);
}

// Permanently deletes the account. Blocked while the user still owns workspaces so
// co-members aren't left in an ownerless workspace; deleting the auth user cascades
// the profile row and workspace memberships via the schema's ON DELETE rules.
export async function deleteAccount(userId: string) {
  const ownedWorkspaces = await countOwnedWorkspaces(userId);
  if (ownedWorkspaces > 0) {
    throw new PublicError("Delete or hand off the workspaces you own before deleting your account.");
  }

  const client = requireSupabaseAdminClient();
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Delete account failed: ${error.message}`);
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  const authClient = getSupabaseAuthClient();
  if (!authClient) return null;
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;

  let profile = await getUserProfile(data.user.id);
  if (!profile) {
    if (!getSupabaseAdminClient()) return null;
    profile = await upsertUserProfile({
      id: data.user.id,
      email: data.user.email,
      displayName: asString(data.user.user_metadata?.display_name),
      role: roleForEmail(data.user.email),
    });
  } else {
    profile = await ensureSeedOwnerProfile(profile);
  }

  return toAppUser(profile);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setActiveWorkspaceCookie(workspaceSlug: string) {
  const slug = workspaceSlugSchema.parse(workspaceSlug);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

// Route Handlers that hand-build a NextResponse (e.g. a redirect) do not pick up
// cookie mutations made through `next/headers`, so the cookie must be written
// onto the response itself. Keeps the cookie attributes in one place.
export function applyActiveWorkspaceCookie(response: NextResponse, workspaceSlug: string) {
  const slug = workspaceSlugSchema.parse(workspaceSlug);
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

// Raw active-workspace slug from the cookie, without a membership/DB lookup. Used
// by the scoped `/w/[slug]` layout to cheaply detect a URL/active mismatch.
export async function getActiveWorkspaceSlug() {
  const cookieStore = await cookies();
  const parsed = workspaceSlugSchema.safeParse(cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value);
  return parsed.success ? parsed.data : undefined;
}

export async function getActiveWorkspaceAccess(userId: string) {
  const cookieStore = await cookies();
  const parsedSlug = workspaceSlugSchema.safeParse(cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value);
  if (!parsedSlug.success) return undefined;

  try {
    return await requireWorkspaceMembership(parsedSlug.data, userId);
  } catch {
    return undefined;
  }
}

export async function requireOperationalWorkspace() {
  const user = await requireUser();
  const access = await getActiveWorkspaceAccess(user.id);
  if (!access) redirect("/onboarding");
  return { user, ...access };
}

export async function requireWorkspaceContext(workspaceSlug?: string) {
  if (!workspaceSlug) return requireOperationalWorkspace();
  return requireWorkspaceUser(workspaceSlug);
}

export async function requireOperationalWorkspaceUser() {
  return (await requireOperationalWorkspace()).user;
}

export async function requireAdmin() {
  const access = await requireOperationalWorkspace();
  if (!isWorkspaceAdmin(access.membership.role) && !isWorkspacePreview(access.workspace.id)) redirect("/tickets");
  return access;
}

export async function requireWorkspaceAdminContext(workspaceSlug?: string) {
  const access = await requireWorkspaceContext(workspaceSlug);
  if (!isWorkspaceAdmin(access.membership.role) && !isWorkspacePreview(access.workspace.id)) {
    redirect(scopedWorkspaceHref(workspaceSlug, "/tickets"));
  }
  return access;
}

export async function requireOwner() {
  const access = await requireOperationalWorkspace();
  if (access.membership.role !== "owner" || isWorkspacePreview(access.workspace.id)) redirect("/tickets");
  return access;
}

export async function requireWorkspaceOwnerContext(workspaceSlug?: string) {
  const access = await requireWorkspaceContext(workspaceSlug);
  if (access.membership.role !== "owner" || isWorkspacePreview(access.workspace.id)) {
    redirect(scopedWorkspaceHref(workspaceSlug, "/tickets"));
  }
  return access;
}

export async function requireWorkspaceUser(workspaceSlug: string) {
  const user = await requireUser();
  const access = await requireWorkspaceMembership(workspaceSlug, user.id);
  return { user, ...access };
}

export async function requireWorkspaceAdmin(workspaceSlug: string) {
  const access = await requireWorkspaceUser(workspaceSlug);
  if (!isWorkspaceAdmin(access.membership.role)) redirect(`/w/${workspaceSlug}`);
  return access;
}

export async function requireWorkspaceOwner(workspaceSlug: string) {
  const access = await requireWorkspaceUser(workspaceSlug);
  if (access.membership.role !== "owner") redirect(`/w/${workspaceSlug}`);
  return access;
}

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (configured) {
    return configured.startsWith("http") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function sanitizeInternalRedirect(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : undefined;
}

// Builds the Google sign-in URL without redirecting the browser, so the caller
// (a same-origin server action) can issue the redirect itself. `next` is sanitized
// to an internal path before being round-tripped through the OAuth callback, and
// the fixed redirectTo must be allowlisted in the Supabase Auth dashboard.
export async function getGoogleOAuthUrl(next?: string) {
  const authClient = requireSupabaseOAuthClient();
  const safeNext = sanitizeInternalRedirect(next);
  const redirectTo = `${getSiteUrl()}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;

  const { data, error } = await authClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data?.url) {
    throw new PublicError(error?.message || "Google sign-in is unavailable right now.");
  }

  return data.url;
}

export async function signUpWithEmail(input: AuthCredentials, next?: string) {
  const credentials = validateSignupInput(input);
  const authClient = requireSupabaseAuthClient();
  const safeNext = sanitizeInternalRedirect(next);
  if (!getSeedAdminEmail()) {
    throw new SetupRequiredError("Seed owner email is required before signup.", ["SEED_ADMIN_EMAIL"]);
  }

  // Run the chosen name through the same filter as the account editor so a profane,
  // link-bearing, or malformed name can't be set at signup and propagate into the
  // profile. Empty is allowed and falls back to the email prefix.
  const displayName = credentials.displayName ? assertCleanDisplayName(credentials.displayName) : credentials.email.split("@")[0];

  const { data, error } = await authClient.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`,
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    // Never disclose that the email is already registered. Return the same
    // "check your email" outcome as a new signup so the form can't be used to
    // enumerate accounts; any other failure is still surfaced.
    if (isExistingUserSignupError(error)) {
      return { email: credentials.email, needsVerification: true };
    }
    // Supabase is throttling confirmation emails / signups. Surface it as a
    // RateLimitError so the signup page can suggest Google (which skips the
    // email flow) instead of showing a dead-end error.
    if (isSupabaseRateLimitError(error)) {
      throw new RateLimitError(
        "We've hit a temporary limit on confirmation emails.",
      );
    }
    throw new PublicError(error.message || "Create account failed.");
  }

  assertEmailVerificationRequired(Boolean(data.session));

  return {
    email: credentials.email,
    needsVerification: true,
  };
}

export async function completeEmailVerification(code: string) {
  const authClient = requireSupabaseAuthClient();
  const { data, error } = await authClient.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user?.email) {
    throw new PublicError(error?.message || "Email verification failed.");
  }

  return completeVerifiedSession({
    user: data.user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}

export async function completeEmailOtpVerification(tokenHash: string, type: string) {
  const authClient = requireSupabaseAuthClient();
  const { data, error } = await authClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error || !data.session || !data.user?.email) {
    throw new PublicError(error?.message || "Email verification failed.");
  }

  return completeVerifiedSession({
    user: data.user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}

export async function completeEmailVerificationFromTokens(input: { accessToken: string; refreshToken: string }) {
  const authClient = requireSupabaseAuthClient();
  const { data, error } = await authClient.auth.getUser(input.accessToken);

  if (error || !data.user?.email) {
    throw new PublicError(error?.message || "Email verification failed.");
  }

  if (!data.user.email_confirmed_at) {
    throw new PublicError("Verify your email before signing in.");
  }

  return completeVerifiedSession({
    user: data.user,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
  });
}

export function getPostVerificationRedirect(next?: string) {
  return sanitizeInternalRedirect(next) ?? getPostAuthWorkspacePath();
}

export async function signInWithEmail(input: { email: string; password: string }): Promise<AppUser> {
  const credentials = validateLoginInput(input);
  const authClient = requireSupabaseAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword(credentials);

  if (error || !data.session || !data.user?.email) {
    if (isEmailNotConfirmedError(error)) {
      throw new PublicError("Verify your email before signing in.");
    }
    // Distinguish an unknown account from a wrong password so the message is
    // actionable. This intentionally reveals whether an email is registered.
    if (isInvalidCredentialsError(error)) {
      const existing = await getUserProfileByEmail(credentials.email);
      throw new PublicError(
        existing ? "Incorrect email or password." : "No account found with this email. Create one to get started.",
      );
    }
    throw new PublicError(error?.message || "Sign in failed.");
  }

  if (!data.user.email_confirmed_at) {
    throw new PublicError("Verify your email before signing in.");
  }

  let profile = await getUserProfile(data.user.id);
  if (!profile) {
    profile = await upsertUserProfile({
      id: data.user.id,
      email: data.user.email,
      displayName: asString(data.user.user_metadata?.display_name),
      role: roleForEmail(data.user.email),
    });
  } else {
    profile = await ensureSeedOwnerProfile(profile);
  }

  await setSessionCookies(data.session.access_token, data.session.refresh_token);
  return toAppUser(profile);
}

export function getAuthSetupMissing() {
  const setup = getRuntimeSetupStatus();
  return setup.missing.filter((item) => item === "NEXT_PUBLIC_SUPABASE_URL" || item === "NEXT_PUBLIC_SUPABASE_ANON_KEY" || item === "SEED_ADMIN_EMAIL");
}

export async function listUserProfiles() {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client.from("user_profiles").select("*").order("created_at", { ascending: false });
  if (error) {
    throw new Error(`List users failed: ${error.message}`);
  }

  return ((data ?? []) as ProfileRow[]).map(profileFromRow);
}

export async function countAdmins() {
  const client = requireSupabaseAdminClient();
  const { count, error } = await client.from("user_profiles").select("id", { count: "exact", head: true }).in("role", ["admin", "owner"]);
  if (error) {
    throw new Error(`Count admins failed: ${error.message}`);
  }

  return count ?? 0;
}

export async function updateUserRole(actor: AppUser, userId: string, role: UserRole) {
  if (actor.role !== "owner") {
    throw new SetupRequiredError("Owner access is required.", []);
  }

  if (role === "owner") {
    throw new Error("Owner access is reserved for the configured seed owner email.");
  }

  const target = await getUserProfile(userId);
  if (!target) {
    throw new Error("User profile not found.");
  }

  if (target.role === "owner") {
    throw new Error("Owner access cannot be changed from user management.");
  }

  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("user_profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Update user role failed: ${error.message}`);
  }

  return profileFromRow(data as ProfileRow);
}
