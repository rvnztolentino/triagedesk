"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginCredentialsSchema, requestSubmissionSchema, reviewApprovalSchema, ticketUpdateSchema, userRoleUpdateSchema, workspaceDepartmentCreateSchema, workspaceDepartmentDeleteSchema, workspaceSlugSchema } from "@/lib/schema";
import {
  clearSessionCookies,
  clearActiveWorkspaceCookie,
  completeEmailVerificationFromTokens,
  getActiveWorkspaceAccess,
  getGoogleOAuthUrl,
  getPostVerificationRedirect,
  requireAdmin,
  requireOperationalWorkspace,
  requireOwner,
  requireUser,
  sanitizeInternalRedirect,
  setActiveWorkspaceCookie,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth";
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
import {
  createWorkspace,
  createWorkspaceInvite,
  deleteWorkspaceInvite,
  deleteWorkspace,
  assertWorkspaceMutable,
  getPostAuthWorkspacePath,
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

async function enforceAuthAttemptLimit(scope: "signin" | "signup" | "oauth", email?: string) {
  const identity = await requestIdentity();
  await enforceRateLimit({
    scope: `auth_${scope}`,
    keyParts: scope === "signin" ? [identity.ip, email || "unknown-email"] : [identity.ip],
    limit: scope === "signin" ? 5 : scope === "signup" ? 3 : 10,
    windowSeconds: scope === "signin" ? 10 * 60 : 60 * 60,
    message: "Too many authentication attempts. Try again later.",
  });
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
    await enforceRequestSubmissionLimits(user.id, workspace.id, attachments);
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
    const { access: { workspace }, workspaceSlug } = await requireActionAdmin(formData);
    assertWorkspaceMutable(workspace.id);
    const input = reviewApprovalSchema.parse({
      requestId: formText(formData, "requestId"),
      title: formText(formData, "title"),
      priority: formText(formData, "priority"),
      department: formText(formData, "department"),
      summary: formText(formData, "summary"),
      note: formText(formData, "note"),
    });
    const ticket = await approveRequest(input, workspace.id);

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
    const { access: { workspace }, workspaceSlug } = await requireActionAdmin(formData);
    assertWorkspaceMutable(workspace.id);
    await rejectRequest(formText(formData, "requestId"), workspace.id);

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
    const { access: { workspace }, workspaceSlug } = await requireActionAdmin(formData);
    assertWorkspaceMutable(workspace.id);
    await markDuplicate(formText(formData, "requestId"), formText(formData, "duplicateOfTicketId"), workspace.id);

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
    const input = ticketUpdateSchema.parse({
      ticketId: formText(formData, "ticketId"),
      status: formText(formData, "status"),
      department: formText(formData, "department"),
      resolutionNotes: formText(formData, "resolutionNotes"),
      note: formText(formData, "note"),
    });
    await updateTicket(input, workspace.id, user?.displayName || "Admin");

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
    const { access: { workspace }, workspaceSlug } = await requireActionOwner(formData);
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

export async function signInAction(formData: FormData) {
  await requireTrustedActionRequest();
  let redirectTo = "/onboarding";
  try {
    const credentials = loginCredentialsSchema.parse({
      email: formText(formData, "email"),
      password: formText(formData, "password"),
    });
    await enforceAuthAttemptLimit("signin", credentials.email);
    await signInWithEmail(credentials);
    redirectTo = sanitizeInternalRedirect(formText(formData, "next")) ?? getPostAuthWorkspacePath();
  } catch (error) {
    const next = sanitizeInternalRedirect(formText(formData, "next"));
    redirectWithError(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`, error);
  }
  redirect(redirectTo);
}

export async function signUpAction(formData: FormData) {
  await requireTrustedActionRequest();
  let redirectTo = "/signup/check-email";
  const next = sanitizeInternalRedirect(formText(formData, "next"));
  try {
    await enforceAuthAttemptLimit("signup");
    const result = await signUpWithEmail({
      email: formText(formData, "email"),
      password: formText(formData, "password"),
      displayName: formText(formData, "displayName"),
    }, next);
    redirectTo = `/signup/check-email?email=${encodeURIComponent(result.email)}`;
  } catch (error) {
    redirectWithError(`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`, error);
  }
  redirect(redirectTo);
}

export async function signInWithGoogleAction(formData: FormData) {
  await requireTrustedActionRequest();
  const next = sanitizeInternalRedirect(formText(formData, "next"));
  const fallback = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  let redirectTo = fallback;
  try {
    await enforceAuthAttemptLimit("oauth");
    redirectTo = await getGoogleOAuthUrl(next);
  } catch (error) {
    captureOperationalError(error, { area: "oauth_google" });
    redirectWithError(fallback, error);
  }
  redirect(redirectTo);
}

export async function completeEmailVerificationFromTokensAction(formData: FormData) {
  await requireTrustedActionRequest();
  try {
    const accessToken = formText(formData, "accessToken");
    const refreshToken = formText(formData, "refreshToken");

    if (!accessToken || !refreshToken) {
      throw new PublicError("Verification link is missing a session token.");
    }

    await completeEmailVerificationFromTokens({ accessToken, refreshToken });
    return { redirectTo: getPostVerificationRedirect(formText(formData, "next")) };
  } catch (error) {
    captureOperationalError(error, { area: "email_verification" });
    return { error: actionErrorMessage(error) };
  }
}

export async function signOutAction() {
  await requireTrustedActionRequest();
  await clearSessionCookies();
  redirect("/login");
}

export async function updateUserRoleAction(formData: FormData) {
  await requireTrustedActionRequest();
  const { access: { user: actor, workspace }, workspaceSlug } = await requireActionOwner(formData);
  assertWorkspaceMutable(workspace.id);
  const input = userRoleUpdateSchema.parse({
    userId: formText(formData, "userId"),
    role: formText(formData, "role"),
  });
  await updateWorkspaceMemberRole(workspace.id, input.userId, input.role, actor.id);

  const returnPath = scopedWorkspaceHref(workspaceSlug, "/users");
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function createWorkspaceDepartmentAction(formData: FormData) {
  await requireTrustedActionRequest();
  const { access: { workspace, membership }, workspaceSlug } = await requireActionAdmin(formData);
  const returnPath = scopedWorkspaceHref(workspaceSlug, "/settings");
  try {
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
    await enforceRateLimit({
      scope: "workspace_create_user_hour",
      keyParts: [user.id],
      limit: 5,
      windowSeconds: 60 * 60,
      message: "Workspace creation limit reached. Try again later.",
    });
    const access = await createWorkspace(formText(formData, "name"), user.id);
    await setActiveWorkspaceCookie(access.workspace.slug);
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
    await enforceInviteJoinLimit(workspaceSlug);
    const access = workspaceSlug
      ? await joinWorkspaceWithInvite(workspaceSlug, code, user.id)
      : await joinWorkspaceWithInviteCode(code, user.id);
    await setActiveWorkspaceCookie(access.workspace.slug);
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
    await revokeWorkspaceInvite(formText(formData, "workspaceId"), formText(formData, "inviteId"), user.id);
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
    await deleteWorkspaceInvite(formText(formData, "workspaceId"), formText(formData, "inviteId"), user.id);
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
    await removeWorkspaceMember(formText(formData, "workspaceId"), formText(formData, "memberUserId"), user.id);
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

export async function activateWorkspaceAction(formData: FormData) {
  await requireTrustedActionRequest();
  const user = await requireUser();
  const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
  const access = await requireWorkspaceMembership(workspaceSlug, user.id);
  await setActiveWorkspaceCookie(workspaceSlug);
  // The active workspace is read from the cookie in the root layout (header +
  // sidebar), so busting the layout cache keeps them in sync after switching.
  revalidatePath("/", "layout");
  redirect(isWorkspacePreview(access.workspace.id) || access.membership.role !== "requester" ? scopedWorkspaceHref(workspaceSlug, "/") : scopedWorkspaceHref(workspaceSlug, "/tickets"));
}
