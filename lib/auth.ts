import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { workspaceSlugSchema, type AppUser, type UserProfileRecord, type UserRole } from "@/lib/schema";
import { getSupabaseAdminClient, getRuntimeSetupStatus, requireSupabaseAdminClient } from "@/lib/supabase";
import { SetupRequiredError } from "@/lib/supabase";
import { PublicError } from "@/lib/errors";
import { assertCleanDisplayName, addMonths, nameChangeStatus, NAME_CHANGE_WINDOW_MONTHS } from "@/lib/display-name";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { countOwnedWorkspaces, getPostAuthWorkspacePath, isWorkspaceAdmin, isWorkspacePreview, requireWorkspaceMembership } from "@/lib/workspaces";

// Keep app-owned cookies (active workspace) for a week. Clerk manages the auth
// session cookie itself; this app no longer hand-rolls access/refresh tokens.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const ACTIVE_WORKSPACE_COOKIE = "triagedesk_active_workspace";

type ProfileRow = Record<string, unknown>;

// Minimal shape of the Clerk user fields we read to seed a new profile. Declared
// locally so we don't depend on Clerk's full User type across the module.
type ClerkUserLike = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  unsafeMetadata?: Record<string, unknown> | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Clerk carries the chosen name in different places depending on the sign-up path:
// our email sign-up stores it in unsafeMetadata.display_name, while Google fills
// firstName/lastName. Fall back across them so social sign-ins get a real name
// instead of the email prefix.
function displayNameFromClerk(user: ClerkUserLike) {
  const metaName = asString(user.unsafeMetadata?.display_name);
  if (metaName) return metaName;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  return asString(user.username);
}

export function getSeedAdminEmail() {
  return normalizeEmail(process.env.SEED_ADMIN_EMAIL || "");
}

export function roleForEmail(email: string): UserRole {
  const seedAdminEmail = getSeedAdminEmail();
  return seedAdminEmail && normalizeEmail(email) === seedAdminEmail ? "owner" : "requester";
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

async function setActiveWorkspaceCookieValue(slug: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

// Clears app-owned session cookies. The Clerk auth session itself is terminated
// client-side (useClerk().signOut); this only drops the active-workspace pointer.
export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

// Upserts a profile keyed by its stable app uuid. Used to correct the seed owner's
// role on an existing row; never sets clerk_user_id (that only changes at creation).
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

// Creates (or, on a race, updates) the profile for a Clerk user, keyed by
// clerk_user_id. The app uuid is generated by the database. Called only when no
// profile exists yet, so it never clobbers a locally-edited display name.
export async function upsertProfileFromClerk(input: { clerkUserId: string; email: string; displayName?: string; role?: UserRole }) {
  const client = requireSupabaseAdminClient();
  const timestamp = new Date().toISOString();
  const role = input.role ?? roleForEmail(input.email);
  const displayName = input.displayName?.trim() || input.email.split("@")[0];
  const { data, error } = await client
    .from("user_profiles")
    .upsert(
      {
        clerk_user_id: input.clerkUserId,
        email: normalizeEmail(input.email),
        display_name: displayName,
        role,
        updated_at: timestamp,
      },
      { onConflict: "clerk_user_id" }
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

// Resolves the app profile from a Clerk user id. This is the identity bridge:
// Clerk owns the session, `clerk_user_id` maps it to our stable uuid primary key.
export async function getUserProfileByClerkId(clerkUserId: string) {
  const client = getSupabaseAdminClient();
  if (!client) return undefined;

  const { data, error } = await client.from("user_profiles").select("*").eq("clerk_user_id", clerkUserId).maybeSingle();
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
// co-members aren't left in an ownerless workspace. Deletes the Clerk user (which
// revokes their sessions) and the profile row; the schema's ON DELETE rules cascade
// the row to workspace memberships, tickets, and notifications.
export async function deleteAccount(userId: string) {
  const ownedWorkspaces = await countOwnedWorkspaces(userId);
  if (ownedWorkspaces > 0) {
    throw new PublicError("Delete or hand off the workspaces you own before deleting your account.");
  }

  const client = requireSupabaseAdminClient();
  const { data, error: fetchError } = await client
    .from("user_profiles")
    .select("clerk_user_id")
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) {
    throw new Error(`Delete account failed: ${fetchError.message}`);
  }

  const clerkUserId = data ? asString((data as ProfileRow).clerk_user_id) : "";
  if (clerkUserId) {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(clerkUserId);
  }

  const { error } = await client.from("user_profiles").delete().eq("id", userId);
  if (error) {
    throw new Error(`Delete account failed: ${error.message}`);
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;
  if (!getSupabaseAdminClient()) return null;

  let profile = await getUserProfileByClerkId(userId);
  if (!profile) {
    // First authenticated request for this Clerk user: seed the profile from the
    // Clerk account (email + name), assigning the owner role to the seed admin.
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) return null;

    profile = await upsertProfileFromClerk({
      clerkUserId: userId,
      email,
      displayName: displayNameFromClerk(clerkUser),
      role: roleForEmail(email),
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
  await setActiveWorkspaceCookieValue(slug);
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

export function getPostVerificationRedirect(next?: string) {
  return sanitizeInternalRedirect(next) ?? getPostAuthWorkspacePath();
}

export function getAuthSetupMissing() {
  const setup = getRuntimeSetupStatus();
  return setup.missing.filter((item) => item === "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" || item === "CLERK_SECRET_KEY" || item === "SEED_ADMIN_EMAIL");
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
