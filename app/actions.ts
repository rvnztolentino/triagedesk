"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestSubmissionSchema, reviewApprovalSchema, ticketUpdateSchema, userRoleUpdateSchema, workspaceDepartmentCreateSchema, workspaceDepartmentDeleteSchema, workspaceSlugSchema, type NotificationView } from "@/lib/schema";
import {
  assertRealUser,
  clearSessionCookies,
  clearActiveWorkspaceCookie,
  deleteAccount,
  getActiveWorkspaceAccess,
  getCurrentUser,
  isDemoUser,
  requireAdmin,
  requireOperationalWorkspace,
  requireOwner,
  requireUser,
  setActiveWorkspaceCookie,
  updateDisplayName,
} from "@/lib/auth";
import { claimDemoWorkspace, clearDemoSessionCookie, enforceDemoTriageLimits, enforceDemoWriteLimit, readDemoSessionId } from "@/lib/demo";
import { requestReceivedHref, scopedWorkspaceHref } from "@/lib/workspace-routing";
import { requireSupabaseAdminClient, SetupRequiredError } from "@/lib/supabase";
import { ZodError } from "zod";
import { type ActionState, PublicError } from "@/lib/errors";
import { captureOperationalError } from "@/lib/monitoring";
import { assertSameOriginRequest, enforceRateLimit, requestIdentity, RateLimitError } from "@/lib/security";
import { runTriage } from "@/lib/triage";
import {
  approveRequest,
  createRequest,
  createRequestAttachment,
  createWorkspaceDepartment,
  deleteWorkspaceDepartment,
  findReusableTriageDraft,
  getSimilarTickets,
  listDepartments,
  markDuplicate,
  rejectRequest,
  resetWorkspaceData,
  saveTriageResult,
  updateTicket,
} from "@/lib/store";
import { clearNotifications, countUnreadNotifications, listNotifications, markAllNotificationsRead } from "@/lib/notifications";
import {
  createWorkspace,
  createWorkspaceInvite,
  deleteWorkspaceInvite,
  deleteWorkspace,
  assertWorkspaceMutable,
  isWorkspaceAdmin,
  isWorkspacePreview,
  joinWorkspaceWithInvite,
  joinWorkspaceWithInviteCode,
  leaveWorkspace,
  removeWorkspaceMember,
  requireWorkspaceMembership,
  revokeWorkspaceInvite,
  updateWorkspaceMemberRole,
} from "@/lib/workspaces";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithError(path: string, error: unknown) {
  const message = actionErrorMessage(error);
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

// Turn a thrown action error into a user-facing message. Validation, rate-limit,
// setup, and explicitly-public errors carry safe, actionable text; anything else
// is reported generically so internal failures (e.g. DB constraint or connection
// errors) never leak to the UI.
function actionErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please check the form and try again.";
  }
  if (error instanceof RateLimitError) {
    return error.message || "You're sending requests too quickly. Please wait a moment and try again.";
  }
  if (error instanceof SetupRequiredError || error instanceof PublicError) {
    return error.message;
  }
  return "We couldn't process your request right now. Please try again in a moment.";
}

async function requireTrustedActionRequest() {
  await assertSameOriginRequest();
}

// Every action a live-demo visitor must not reach funnels through here. The database
// backs the two highest-value cases (creating and joining workspaces) with its own
// check, so an omission here degrades to a worse error rather than to a hole — but
// this layer is what turns the block into a message the visitor can act on.
async function assertRealActionUser() {
  const user = await requireUser();
  assertRealUser(user);
  return user;
}

// Demo sessions are metered separately from signed-in users: their limits key on the
// demo session id and on IP, because the cookie behind a demo identity is free to
// reset and a per-user cap alone would mean nothing.
async function enforceDemoTriageBudget(user: { isDemo: boolean }) {
  if (!isDemoUser(user)) return;
  const sessionId = await readDemoSessionId();
  if (sessionId) await enforceDemoTriageLimits(sessionId);
}

async function enforceDemoMutationBudget(user: { isDemo: boolean } | undefined) {
  if (!user || !isDemoUser(user)) return;
  const sessionId = await readDemoSessionId();
  if (sessionId) await enforceDemoWriteLimit(sessionId);
}

async function enforceInviteJoinLimit(workspaceSlug: string) {
  const identity = await requestIdentity();
  await enforceRateLimit({
    scope: "invite_join",
    keyParts: [identity.ip, workspaceSlug || "any-workspace"],
    limit: 10,
    windowSeconds: 60 * 60,
    message: "Too many invite attempts. Try again later.",
  });
}

async function enforceRequestSubmissionLimits(userId: string, workspaceId: string, attachments: File[]) {
  await enforceRateLimit({
    scope: "request_submit_user_hour",
    keyParts: [userId],
    limit: 5,
    windowSeconds: 60 * 60,
    message: "Request submission limit reached. Try again later.",
  });
  await enforceRateLimit({
    scope: "request_submit_workspace_day",
    keyParts: [workspaceId],
    limit: 30,
    windowSeconds: 24 * 60 * 60,
    message: "Workspace daily request limit reached. Try again tomorrow.",
  });

  const uploadBytes = attachments.reduce((total, file) => total + file.size, 0);
  if (uploadBytes > 0) {
    await enforceRateLimit({
      scope: "workspace_upload_bytes_day",
      keyParts: [workspaceId],
      limit: MAX_WORKSPACE_UPLOAD_BYTES_PER_DAY,
      windowSeconds: 24 * 60 * 60,
      incrementBy: uploadBytes,
      message: "Workspace daily upload limit reached. Try again tomorrow.",
    });
  }
}

// Per-user, per-workspace hourly cap for admin mutations that write to the DB and
// fan out notifications/activity-log entries. Loose by design — sized to stop a
// runaway loop or compromised session, not to throttle normal admin work.
async function enforceAdminMutationLimit(
  scope: string,
  userId: string | undefined,
  workspaceId: string,
  limit: number,
  message: string,
) {
  await enforceRateLimit({
    scope,
    keyParts: [userId || "unknown-user", workspaceId],
    limit,
    windowSeconds: 60 * 60,
    message,
  });
}

async function requireActionWorkspace(formData: FormData) {
  const workspaceSlug = formText(formData, "workspaceSlug");
  if (!workspaceSlug) return { access: await requireOperationalWorkspace(), workspaceSlug: undefined };
  const user = await requireUser();
  const access = await requireWorkspaceMembership(workspaceSlugSchema.parse(workspaceSlug), user.id);
  return { access: { user, ...access }, workspaceSlug: access.workspace.slug };
}

async function requireActionAdmin(formData: FormData) {
  const context = await requireActionWorkspace(formData);
  if (!isWorkspaceAdmin(context.access.membership.role) && !isWorkspacePreview(context.access.workspace.id)) {
    redirect(scopedWorkspaceHref(context.workspaceSlug, "/tickets"));
  }
  return context;
}

async function requireActionOwner(formData?: FormData) {
  const context = formData ? await requireActionWorkspace(formData) : { access: await requireOwner(), workspaceSlug: undefined };
  if (context.access.membership.role !== "owner" || isWorkspacePreview(context.access.workspace.id)) {
    redirect(scopedWorkspaceHref(context.workspaceSlug, "/tickets"));
  }
  return context;
}

function fileExtension(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return match?.[0] ?? "";
}

const MAX_REQUEST_ATTACHMENTS = 3;
const MAX_REQUEST_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_WORKSPACE_UPLOAD_BYTES_PER_DAY = 100 * 1024 * 1024;
const allowedAttachmentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
  [".csv", "text/csv"],
  [".json", "application/json"],
]);

function requestAttachmentBucket() {
  return process.env.SUPABASE_REQUEST_ATTACHMENTS_BUCKET || process.env.SUPABASE_REQUEST_IMAGES_BUCKET || "request-attachments";
}

function sanitizeFileName(name: string) {
  const normalized = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "attachment";
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

function isUtf8(bytes: Uint8Array) {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

async function validateAttachmentSignature(file: File, extension: string) {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 4096)).arrayBuffer());
  const ascii = new TextDecoder("latin1").decode(bytes);

  const valid = extension === ".jpg" || extension === ".jpeg"
    ? hasPrefix(bytes, [0xff, 0xd8, 0xff])
    : extension === ".png"
      ? hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : extension === ".webp"
        ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
        : extension === ".pdf"
          ? ascii.startsWith("%PDF-")
          : extension === ".docx"
            ? hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])
            : [".txt", ".csv", ".json"].includes(extension)
              ? isUtf8(bytes)
              : false;

  if (!valid) {
    throw new Error(`${file.name} does not match its declared file type.`);
  }

  if (extension === ".json") {
    try {
      JSON.parse(await file.text());
    } catch {
      throw new Error(`${file.name} must contain valid JSON.`);
    }
  }
}

async function validateRequestAttachments(formData: FormData) {
  const files = formData.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_REQUEST_ATTACHMENTS) {
    throw new Error(`Attach up to ${MAX_REQUEST_ATTACHMENTS} files per request.`);
  }

  for (const file of files) {
    const extension = fileExtension(file.name);
    const expectedType = allowedAttachmentTypes.get(extension);
    if (!expectedType) {
      throw new Error("Attachments must be JPG, PNG, WebP, PDF, DOCX, TXT, CSV, or JSON files.");
    }
    if (file.type && file.type !== expectedType && !(extension === ".csv" && file.type === "application/vnd.ms-excel")) {
      throw new Error(`${file.name} does not match an allowed file type.`);
    }
    if (file.size > MAX_REQUEST_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} must be 10 MB or smaller.`);
    }
    await validateAttachmentSignature(file, extension);
  }

  return files;
}

async function removeUploadedAttachments(paths: string[]) {
  if (paths.length === 0) return;

  try {
    const client = requireSupabaseAdminClient();
    await client.storage.from(requestAttachmentBucket()).remove(paths);
  } catch (error) {
    captureOperationalError(error, { area: "attachment_cleanup" });
  }
}

async function saveRequestAttachment(file: File, workspaceId: string, requestId: string) {
  const client = requireSupabaseAdminClient();
  const bucket = requestAttachmentBucket();
  const fileName = sanitizeFileName(file.name);
  const extension = fileExtension(fileName);
  const storagePath = `${workspaceId}/requests/${requestId}/${crypto.randomUUID()}-${fileName}`;
  const { error } = await client.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
    contentType: file.type || allowedAttachmentTypes.get(extension) || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`Attachment upload failed: ${error.message}`);
  }

  return {
    fileName,
    storagePath,
    contentType: file.type || allowedAttachmentTypes.get(extension) || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export async function submitRequestAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string;

  try {
    await requireTrustedActionRequest();
    const { access: { user, workspace }, workspaceSlug } = await requireActionWorkspace(formData);
    assertWorkspaceMutable(workspace.id);
    const input = requestSubmissionSchema.parse({
      description: formText(formData, "description"),
      location: formText(formData, "location"),
      contactName: formText(formData, "contactName"),
      urgencyNote: formText(formData, "urgencyNote"),
    });
    requireSupabaseAdminClient();
    const attachments = await validateRequestAttachments(formData);
    // No storage access for demo sessions, in either direction. Anonymous uploads to a
    // shared bucket are the one part of this flow with a cost and a blast radius that
    // outlive the demo workspace itself.
    if (attachments.length > 0) assertRealUser(user);
    await enforceRequestSubmissionLimits(user.id, workspace.id, attachments);
    await enforceDemoTriageBudget(user);
    const departments = await listDepartments(workspace.id);
    const similarTickets = await getSimilarTickets(`${input.description} ${input.location} ${input.urgencyNote}`, undefined, workspace.id);
    const reusableTriage = await findReusableTriageDraft(input, workspace.id);
    const triage = reusableTriage
      ? {
          ...reusableTriage,
          similarTicketIds: similarTickets.slice(0, 3).map((ticket) => ticket.id),
        }
      : await runTriage({ ...input, similarTickets, departments });
    const request = await createRequest(input, user, workspace.id);
    const uploadedPaths: string[] = [];
    for (const attachment of attachments) {
      const upload = await saveRequestAttachment(attachment, workspace.id, request.id);
      uploadedPaths.push(upload.storagePath);
      try {
        await createRequestAttachment(request.id, upload, workspace.id);
      } catch (error) {
        await removeUploadedAttachments(uploadedPaths);
        throw error;
      }
    }
    await saveTriageResult(request.id, triage, workspace.id);

    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/review"));
    destination = requestReceivedHref(workspaceSlug, request.id);
  } catch (error) {
    captureOperationalError(error, { area: "submit_request" });
    return { error: actionErrorMessage(error) };
  }

  // redirect() throws a control-flow signal, so it must live outside the
  // try/catch above or it would be swallowed as a failure.
  redirect(destination);
}

export async function approveRequestAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string;
  try {
    await requireTrustedActionRequest();
    const { access: { workspace, user }, workspaceSlug } = await requireActionAdmin(formData);
    assertWorkspaceMutable(workspace.id);
    await enforceAdminMutationLimit("request_approve_user_hour", user?.id, workspace.id, 60, "Too many approvals. Try again later.");
    await enforceDemoMutationBudget(user);
    const input = reviewApprovalSchema.parse({
      requestId: formText(formData, "requestId"),
      title: formText(formData, "title"),
      priority: formText(formData, "priority"),
      department: formText(formData, "department"),
      summary: formText(formData, "summary"),
      note: formText(formData, "note"),
    });
    const ticket = await approveRequest(input, workspace.id, { id: user.id, name: user.displayName || "An admin" });

    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/review"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/tickets"));
    destination = scopedWorkspaceHref(workspaceSlug, `/tickets/${ticket.id}`);
  } catch (error) {
    captureOperationalError(error, { area: "approve_request" });
    return { error: actionErrorMessage(error) };
  }
  redirect(destination);
}

export async function rejectRequestAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string;
  try {
    await requireTrustedActionRequest();
    const { access: { workspace, user }, workspaceSlug } = await requireActionAdmin(formData);
    assertWorkspaceMutable(workspace.id);
    await enforceAdminMutationLimit("request_reject_user_hour", user?.id, workspace.id, 60, "Too many rejections. Try again later.");
    await rejectRequest(formText(formData, "requestId"), workspace.id, { id: user.id, name: user.displayName || "An admin" });

    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/review"));
    destination = scopedWorkspaceHref(workspaceSlug, "/review");
  } catch (error) {
    captureOperationalError(error, { area: "reject_request" });
    return { error: actionErrorMessage(error) };
  }
  redirect(destination);
}

export async function markDuplicateAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string;
  try {
    await requireTrustedActionRequest();
    const { access: { workspace, user }, workspaceSlug } = await requireActionAdmin(formData);
    assertWorkspaceMutable(workspace.id);
    await enforceAdminMutationLimit("request_mark_duplicate_user_hour", user?.id, workspace.id, 60, "Too many actions. Try again later.");
    await markDuplicate(formText(formData, "requestId"), formText(formData, "duplicateOfTicketId"), workspace.id, { id: user.id, name: user.displayName || "An admin" });

    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/review"));
    destination = scopedWorkspaceHref(workspaceSlug, "/review");
  } catch (error) {
    captureOperationalError(error, { area: "mark_duplicate" });
    return { error: actionErrorMessage(error) };
  }
  redirect(destination);
}

export async function updateTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string;
  try {
    await requireTrustedActionRequest();
    const { access: { workspace, user }, workspaceSlug } = await requireActionAdmin(formData);
    assertWorkspaceMutable(workspace.id);
    await enforceAdminMutationLimit("ticket_update_user_hour", user?.id, workspace.id, 60, "Too many ticket updates. Try again later.");
    await enforceDemoMutationBudget(user);
    const input = ticketUpdateSchema.parse({
      ticketId: formText(formData, "ticketId"),
      status: formText(formData, "status"),
      department: formText(formData, "department"),
      resolutionNotes: formText(formData, "resolutionNotes"),
      note: formText(formData, "note"),
    });
    await updateTicket(input, workspace.id, user?.displayName || "Admin", user?.id);

    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/tickets"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, `/tickets/${input.ticketId}`));
    destination = scopedWorkspaceHref(workspaceSlug, `/tickets/${input.ticketId}`);
  } catch (error) {
    captureOperationalError(error, { area: "update_ticket" });
    return { error: actionErrorMessage(error) };
  }
  redirect(destination);
}

export async function resetWorkspaceDataAction(_prevState: ActionState, formData?: FormData): Promise<ActionState> {
  let destination: string;
  try {
    await requireTrustedActionRequest();
    const { access: { workspace, user }, workspaceSlug } = await requireActionOwner(formData);
    // Reseeding rewrites the whole workspace. A demo visitor's copy is already seeded
    // and disposable, so this only offers a way to churn rows at no cost to them.
    assertRealUser(user);
    assertWorkspaceMutable(workspace.id);
    await resetWorkspaceData(workspace.id);

    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/review"));
    revalidatePath(scopedWorkspaceHref(workspaceSlug, "/tickets"));
    destination = scopedWorkspaceHref(workspaceSlug, "/");
  } catch (error) {
    captureOperationalError(error, { area: "reset_workspace" });
    return { error: actionErrorMessage(error) };
  }
  redirect(destination);
}

// Returns the current user's latest notifications + unread count for the active
// workspace. Polled by the bell so new activity appears without a full navigation.
// Reads auth from the httpOnly cookie server-side; never throws to the client.
export async function fetchNotificationsAction(): Promise<{ notifications: NotificationView[]; unreadCount: number }> {
  try {
    await requireTrustedActionRequest();
    const user = await getCurrentUser();
    if (!user) return { notifications: [], unreadCount: 0 };
    const access = await getActiveWorkspaceAccess(user.id);
    if (!access) return { notifications: [], unreadCount: 0 };
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(user.id, access.workspace.id),
      countUnreadNotifications(user.id, access.workspace.id),
    ]);
    return { notifications, unreadCount };
  } catch (error) {
    captureOperationalError(error, { area: "fetch_notifications" });
    return { notifications: [], unreadCount: 0 };
  }
}

// Deletes all of the current user's notifications in the (scoped or active)
// workspace. Backs the "Clear all" button on the notifications page.
export async function clearNotificationsAction(formData: FormData) {
  await requireTrustedActionRequest();
  const workspaceSlug = formText(formData, "workspaceSlug");
  try {
    const user = await requireUser();
    const access = workspaceSlug
      ? await requireWorkspaceMembership(workspaceSlugSchema.parse(workspaceSlug), user.id)
      : await getActiveWorkspaceAccess(user.id);
    if (access) {
      await clearNotifications(user.id, access.workspace.id);
    }
  } catch (error) {
    captureOperationalError(error, { area: "clear_notifications" });
  }
  const returnPath = scopedWorkspaceHref(workspaceSlug || undefined, "/notifications");
  revalidatePath(returnPath);
  redirect(returnPath);
}

// Marks every unread notification for the current user in the active workspace as
// read. Called by the bell when its panel opens; no revalidate so the current
// view keeps its "unread" highlights while the badge clears on next navigation.
export async function markNotificationsReadAction() {
  await requireTrustedActionRequest();
  try {
    const { user, workspace } = await requireOperationalWorkspace();
    await markAllNotificationsRead(user.id, workspace.id);
  } catch (error) {
    captureOperationalError(error, { area: "mark_notifications_read" });
  }
}

// Clears app-owned cookies before the client terminates the Clerk session. The
// caller (the sign-out menu item) runs Clerk's signOut with a redirect afterward,
// so this action intentionally does not redirect on its own.
export async function signOutAction() {
  await requireTrustedActionRequest();
  await clearSessionCookies();
  // A demo visitor has no Clerk session to end, so the demo cookie is the only thing
  // that makes them "signed in". Drop it or signing out is a no-op for them.
  await clearDemoSessionCookie();
}

// Conversion. A visitor who signed up still carries their demo cookie, so the
// workspace hub offers to hand the demo workspace to the account they just made.
// Everything that can go wrong here (workspace cap, an expiry that landed mid-flow,
// a session that already ended) comes back from claimDemoWorkspace as a PublicError
// with text worth showing, and leaves the demo untouched and retryable.
export async function keepDemoWorkspaceAction() {
  await requireTrustedActionRequest();
  const user = await requireUser();
  let redirectTo = "/onboarding";
  try {
    // The RPC refuses a demo profile too. Checking first turns a raw Postgres error
    // into a sentence that tells the visitor what to do about it.
    if (isDemoUser(user)) {
      throw new PublicError("Create your free account first, then this workspace can be kept.");
    }
    const claimed = await claimDemoWorkspace(user.id);
    await setActiveWorkspaceCookie(claimed.workspaceSlug);
    // The header, sidebar, and hub all read the active workspace from the cookie.
    revalidatePath("/", "layout");
    revalidatePath("/onboarding");
    redirectTo = `/w/${claimed.workspaceSlug}`;
  } catch (error) {
    captureOperationalError(error, { area: "demo_workspace_keep", demo: true });
    redirectWithError("/onboarding", error);
  }
  redirect(redirectTo);
}

// "No thanks" on the same card. Only the cookie is dropped — the workspace keeps its
// original expiry and the sweep collects it, which is also what happens when someone
// abandons sign-up halfway. Nothing is deleted here that a visitor might want back.
export async function discardDemoWorkspaceAction() {
  await requireTrustedActionRequest();
  await requireUser();
  await clearDemoSessionCookie();
  revalidatePath("/onboarding");
  redirect("/onboarding");
}

// Backs the expired-demo screen. There is no session left to authorize against, so
// this deliberately does not require a user — it just clears the cookies that would
// otherwise keep routing the visitor back to that screen. The active-workspace cookie
// is only dropped when a demo cookie was actually present, so a real signed-in user
// who reaches this action can't be made to lose their open workspace.
export async function endDemoSessionAction() {
  await requireTrustedActionRequest();
  const hadDemoSession = Boolean(await readDemoSessionId());
  await clearDemoSessionCookie();
  if (hadDemoSession) await clearActiveWorkspaceCookie();
  redirect("/");
}

export async function updateAccountNameAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  try {
    // Demo profiles are throwaway and shared-shaped; renaming one has no meaning and
    // the name-change allowance is a real-account concept.
    assertRealUser(user);
    await updateDisplayName(user.id, formText(formData, "displayName"));
    // The header and profile menu read the name from the root layout, so refresh
    // the whole layout tree, not just the account page.
    revalidatePath("/", "layout");
    revalidatePath("/account");
  } catch (error) {
    captureOperationalError(error, { area: "update_account_name" });
    redirectWithError("/account", error);
  }
  redirect("/account?updated=name");
}

export async function deleteAccountAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  try {
    // There is no Clerk account behind a demo profile to delete, and deleteAccount
    // would happily remove the profile row out from under the live demo session.
    assertRealUser(user);
    if (formText(formData, "confirmation") !== "DELETE") {
      throw new PublicError("Type DELETE to confirm account deletion.");
    }
    await deleteAccount(user.id);
  } catch (error) {
    captureOperationalError(error, { area: "delete_account" });
    redirectWithError("/account", error);
  }
  // Account is gone; drop every session cookie before returning to sign-in.
  await clearSessionCookies();
  redirect("/login?deleted=1");
}

export async function updateUserRoleAction(formData: FormData) {
  await requireTrustedActionRequest();
  const { access: { user: actor, workspace }, workspaceSlug } = await requireActionOwner(formData);
  const returnPath = scopedWorkspaceHref(workspaceSlug, "/users");
  try {
    assertRealUser(actor);
    assertWorkspaceMutable(workspace.id);
    await enforceAdminMutationLimit("member_role_update_user_hour", actor.id, workspace.id, 30, "Too many role changes. Try again later.");
    const input = userRoleUpdateSchema.parse({
      userId: formText(formData, "userId"),
      role: formText(formData, "role"),
    });
    await updateWorkspaceMemberRole(workspace.id, input.userId, input.role, actor.id);
    revalidatePath(returnPath);
  } catch (error) {
    redirectWithError(returnPath, error);
  }
  redirect(returnPath);
}

export async function createWorkspaceDepartmentAction(formData: FormData) {
  await requireTrustedActionRequest();
  const { access: { user, workspace, membership }, workspaceSlug } = await requireActionAdmin(formData);
  const returnPath = scopedWorkspaceHref(workspaceSlug, "/settings");
  try {
    await enforceRateLimit({
      scope: "department_create_user_hour",
      keyParts: [user.id],
      limit: 20,
      windowSeconds: 60 * 60,
      message: "You're creating departments too quickly. Try again later.",
    });
    const input = workspaceDepartmentCreateSchema.parse({
      workspaceId: workspace.id,
      id: formText(formData, "id"),
      name: formText(formData, "name"),
      description: formText(formData, "description"),
    });
    await createWorkspaceDepartment(input, membership.role);
    revalidatePath(returnPath);
  } catch (error) {
    redirectWithError(returnPath, error);
  }
  redirect(returnPath);
}

export async function deleteWorkspaceDepartmentAction(formData: FormData) {
  await requireTrustedActionRequest();
  const { access: { workspace, membership }, workspaceSlug } = await requireActionAdmin(formData);
  const returnPath = scopedWorkspaceHref(workspaceSlug, "/settings");
  try {
    const input = workspaceDepartmentDeleteSchema.parse({
      workspaceId: workspace.id,
      id: formText(formData, "id"),
    });
    await deleteWorkspaceDepartment(input, membership.role);
    revalidatePath(returnPath);
  } catch (error) {
    redirectWithError(returnPath, error);
  }
  redirect(returnPath);
}

export async function createWorkspaceAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  let redirectTo = "/onboarding";
  try {
    // A demo visitor already has their one workspace. Without this, anonymous traffic
    // could mint unlimited real workspaces with no account behind them.
    assertRealUser(user);
    await enforceRateLimit({
      scope: "workspace_create_user_hour",
      keyParts: [user.id],
      limit: 5,
      windowSeconds: 60 * 60,
      message: "Workspace creation limit reached. Try again later.",
    });
    const access = await createWorkspace(formText(formData, "name"), user.id);
    // Only make the new workspace active when the user has no workspace open yet.
    // If another workspace is already open, keep it active so creating a workspace
    // doesn't yank the user out of the one they're working in — the scoped layout
    // then shows the switch prompt on the new workspace's page, matching how
    // opening a link to a non-active workspace behaves.
    const activeWorkspace = await getActiveWorkspaceAccess(user.id);
    if (!activeWorkspace) {
      await setActiveWorkspaceCookie(access.workspace.slug);
    }
    // The active workspace is read from the cookie in the root layout (header +
    // sidebar) and the onboarding hub, so bust their caches to reflect the current
    // active workspace and list the newly created one.
    revalidatePath("/", "layout");
    revalidatePath("/onboarding");
    redirectTo = `/w/${access.workspace.slug}`;
  } catch (error) {
    redirectWithError("/onboarding", error);
  }
  redirect(redirectTo);
}

export async function joinWorkspaceAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = formText(formData, "workspaceSlug");
  const code = formText(formData, "code");
  let redirectTo = "/onboarding";

  try {
    // The one that matters most: an invite code is a real workspace's front door, and
    // a demo principal must never be able to walk through it. Only a Clerk-backed
    // account can accept an invite.
    assertRealUser(user);
    await enforceInviteJoinLimit(workspaceSlug);
    const access = workspaceSlug
      ? await joinWorkspaceWithInvite(workspaceSlug, code, user.id)
      : await joinWorkspaceWithInviteCode(code, user.id);
    await setActiveWorkspaceCookie(access.workspace.slug);
    // Joining switches the active workspace, so bust the layout + hub caches the
    // same way activation does (otherwise they keep showing the previous one).
    revalidatePath("/", "layout");
    revalidatePath("/onboarding");
    redirectTo = `/w/${access.workspace.slug}`;
  } catch (error) {
    const returnPath = workspaceSlug ? `/join/${encodeURIComponent(workspaceSlug)}?code=${encodeURIComponent(code)}` : "/onboarding";
    redirectWithError(returnPath, error);
  }
  redirect(redirectTo);
}

export async function createWorkspaceInviteAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
  let redirectTo = `/w/${workspaceSlug}`;
  try {
    // Demo workspaces are single-occupancy by design: no invites out, so a visitor
    // cannot pull anyone else into a workspace that is about to be deleted.
    assertRealUser(user);
    await enforceRateLimit({
      scope: "invite_create_user_hour",
      keyParts: [user.id],
      limit: 10,
      windowSeconds: 60 * 60,
      message: "You're creating invites too quickly. Try again later.",
    });
    const invite = await createWorkspaceInvite(formText(formData, "workspaceId"), formText(formData, "role") as "requester" | "admin", user.id);
    revalidatePath(`/w/${workspaceSlug}`);
    redirectTo = `/w/${workspaceSlug}?invite=${encodeURIComponent(invite.code)}`;
  } catch (error) {
    redirectWithError(`/w/${workspaceSlug}`, error);
  }
  redirect(redirectTo);
}

export async function revokeWorkspaceInviteAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
  try {
    assertRealUser(user);
    const workspaceId = formText(formData, "workspaceId");
    await enforceAdminMutationLimit("invite_revoke_user_hour", user.id, workspaceId, 30, "Too many invite changes. Try again later.");
    await revokeWorkspaceInvite(workspaceId, formText(formData, "inviteId"), user.id);
    revalidatePath(`/w/${workspaceSlug}`);
  } catch (error) {
    redirectWithError(`/w/${workspaceSlug}`, error);
  }
  redirect(`/w/${workspaceSlug}`);
}

export async function deleteWorkspaceInviteAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
  try {
    assertRealUser(user);
    const workspaceId = formText(formData, "workspaceId");
    await enforceAdminMutationLimit("invite_delete_user_hour", user.id, workspaceId, 30, "Too many invite changes. Try again later.");
    await deleteWorkspaceInvite(workspaceId, formText(formData, "inviteId"), user.id);
    revalidatePath(`/w/${workspaceSlug}`);
  } catch (error) {
    redirectWithError(`/w/${workspaceSlug}`, error);
  }
  redirect(`/w/${workspaceSlug}`);
}

export async function leaveWorkspaceAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
  try {
    assertRealUser(user);
    const workspaceId = formText(formData, "workspaceId");
    const activeWorkspace = await getActiveWorkspaceAccess(user.id);
    await leaveWorkspace(workspaceId, user.id);
    if (activeWorkspace?.workspace.id === workspaceId) {
      await clearActiveWorkspaceCookie();
    }
    revalidatePath("/onboarding");
  } catch (error) {
    redirectWithError(`/w/${workspaceSlug}`, error);
  }
  redirect("/onboarding");
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = formText(formData, "workspaceSlug");
  const returnPath = scopedWorkspaceHref(workspaceSlug || undefined, "/users");
  try {
    assertRealUser(user);
    const workspaceId = formText(formData, "workspaceId");
    await enforceAdminMutationLimit("member_remove_user_hour", user.id, workspaceId, 30, "Too many member changes. Try again later.");
    await removeWorkspaceMember(workspaceId, formText(formData, "memberUserId"), user.id);
    revalidatePath(returnPath);
    revalidatePath("/onboarding");
  } catch (error) {
    redirectWithError(returnPath, error);
  }
  redirect(returnPath);
}

export async function deleteWorkspaceAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  try {
    // Demo workspaces are removed by the expiry sweep, not by their visitor. Letting
    // a demo session delete its own workspace only creates a broken-session state.
    assertRealUser(user);
    const workspaceId = formText(formData, "workspaceId");
    const activeWorkspace = await getActiveWorkspaceAccess(user.id);
    await deleteWorkspace(workspaceId, formText(formData, "confirmation"), user.id);
    if (activeWorkspace?.workspace.id === workspaceId) {
      await clearActiveWorkspaceCookie();
    }
    revalidatePath("/onboarding");
  } catch (error) {
    const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
    redirectWithError(`/w/${workspaceSlug}`, error);
  }
  redirect("/onboarding");
}

// Only honor a caller-supplied return path when it clearly belongs to the target
// workspace. Anything else (including protocol-relative URLs) is rejected so the
// redirect can't be pointed off-site or into a different workspace.
function safeWorkspaceReturnPath(next: string, workspaceSlug: string) {
  return next === `/w/${workspaceSlug}` || next.startsWith(`/w/${workspaceSlug}/`) ? next : undefined;
}

// Single entry point for opening/switching the active workspace, used by every
// switch prompt (deep-link gate, join "already belong", onboarding hub).
//
// It MUST redirect: the active workspace lives in a cookie the root layout reads
// for the header, sidebar, and preview banner. A client-side revalidate alone
// leaves that shared layout rendered from the old cookie until a manual refresh;
// a navigation is what reliably re-renders it. When the user deep-linked into a
// page of the target workspace we return there, otherwise its dashboard/tickets.
export async function switchActiveWorkspaceAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
  const access = await requireWorkspaceMembership(workspaceSlug, user.id);
  await setActiveWorkspaceCookie(workspaceSlug);
  revalidatePath("/", "layout");
  revalidatePath("/onboarding");
  const landing =
    isWorkspacePreview(access.workspace.id) || access.membership.role !== "requester"
      ? scopedWorkspaceHref(workspaceSlug, "/")
      : scopedWorkspaceHref(workspaceSlug, "/tickets");
  redirect(safeWorkspaceReturnPath(formText(formData, "next"), workspaceSlug) ?? landing);
}
