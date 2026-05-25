import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { authCredentialsSchema, loginCredentialsSchema, type AppUser, type AuthCredentials, type UserProfileRecord, type UserRole } from "@/lib/schema";
import { getSupabaseAdminClient, getSupabaseAuthClient, getRuntimeSetupStatus, requireSupabaseAdminClient, requireSupabaseAuthClient, SetupRequiredError } from "@/lib/supabase";

const ACCESS_COOKIE = "triagedesk_access_token";
const REFRESH_COOKIE = "triagedesk_refresh_token";
const COOKIE_MAX_AGE = 60 * 60 * 8;
const PASSWORD_RESET_COOKIE = "triagedesk_pending_auth";

type ProfileRow = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

function profileFromRow(row: ProfileRow): UserProfileRecord {
  const role = asString(row.role);
  return {
    id: asString(row.id),
    email: asString(row.email),
    displayName: asString(row.display_name),
    role: role === "owner" || role === "admin" ? role : "requester",
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
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

function verificationRedirectFor(user: AppUser) {
  return user.role === "admin" || user.role === "owner" ? "/" : "/submit";
}

function isPrivilegedRole(role: UserRole) {
  return role === "admin" || role === "owner";
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
    displayName: asString(input.user.user_metadata?.display_name),
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

export async function requireAdmin() {
  const user = await requireUser();
  if (!isPrivilegedRole(user.role)) redirect("/tickets");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/tickets");
  return user;
}

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (configured) {
    return configured.startsWith("http") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export async function signUpWithEmail(input: AuthCredentials) {
  const credentials = validateSignupInput(input);
  const authClient = requireSupabaseAuthClient();
  if (!getSeedAdminEmail()) {
    throw new SetupRequiredError("Seed owner email is required before signup.", ["SEED_ADMIN_EMAIL"]);
  }

  const { data, error } = await authClient.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: {
        display_name: credentials.displayName || credentials.email.split("@")[0],
      },
    },
  });

  if (error) {
    throw new Error(error.message || "Create account failed.");
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
    throw new Error(error?.message || "Email verification failed.");
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
    throw new Error(error?.message || "Email verification failed.");
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
    throw new Error(error?.message || "Email verification failed.");
  }

  if (!data.user.email_confirmed_at) {
    throw new Error("Verify your email before signing in.");
  }

  return completeVerifiedSession({
    user: data.user,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
  });
}

export function getPostVerificationRedirect(user: AppUser) {
  return verificationRedirectFor(user);
}

export async function signInWithEmail(input: { email: string; password: string }) {
  const credentials = validateLoginInput(input);
  const authClient = requireSupabaseAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword(credentials);

  if (error || !data.session || !data.user?.email) {
    throw new Error(error?.message || "Sign in failed.");
  }

  if (!data.user.email_confirmed_at) {
    throw new Error("Verify your email before signing in.");
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
