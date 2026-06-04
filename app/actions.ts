"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginCredentialsSchema, requestSubmissionSchema, reviewApprovalSchema, ticketUpdateSchema, userRoleUpdateSchema, workspaceDepartmentCreateSchema, workspaceDepartmentDeleteSchema, workspaceSlugSchema } from "@/lib/schema";
import {
  clearSessionCookies,
  clearActiveWorkspaceCookie,
  completeEmailVerificationFromTokens,
  getActiveWorkspaceAccess,
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
import { requireSupabaseAdminClient } from "@/lib/supabase";
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
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

function fileExtension(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return match?.[0] ?? "";
}

const MAX_REQUEST_ATTACHMENTS = 5;
const MAX_REQUEST_ATTACHMENT_BYTES = 10 * 1024 * 1024;
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

function validateRequestAttachments(formData: FormData) {
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
  }

  return files;
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

export async function submitRequestAction(formData: FormData) {
  const { user, workspace } = await requireOperationalWorkspace();
  assertWorkspaceMutable(workspace.id);
  const input = requestSubmissionSchema.parse({
    description: formText(formData, "description"),
    location: formText(formData, "location"),
    contactName: formText(formData, "contactName"),
    urgencyNote: formText(formData, "urgencyNote"),
  });
  requireSupabaseAdminClient();
  const attachments = validateRequestAttachments(formData);
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
  for (const attachment of attachments) {
    const upload = await saveRequestAttachment(attachment, workspace.id, request.id);
    await createRequestAttachment(request.id, upload, workspace.id);
  }
  await saveTriageResult(request.id, triage, workspace.id);

  revalidatePath("/");
  revalidatePath("/review");
  redirect(`/submit/confirm?id=${request.id}`);
}

export async function approveRequestAction(formData: FormData) {
  const { workspace } = await requireAdmin();
  assertWorkspaceMutable(workspace.id);
  const input = reviewApprovalSchema.parse({
    requestId: formText(formData, "requestId"),
    title: formText(formData, "title"),
    priority: formText(formData, "priority"),
    department: formText(formData, "department"),
    summary: formText(formData, "summary"),
  });
  const ticket = await approveRequest(input, workspace.id);

  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function rejectRequestAction(formData: FormData) {
  const { workspace } = await requireAdmin();
  assertWorkspaceMutable(workspace.id);
  await rejectRequest(formText(formData, "requestId"), workspace.id);

  revalidatePath("/");
  revalidatePath("/review");
  redirect("/review");
}

export async function markDuplicateAction(formData: FormData) {
  const { workspace } = await requireAdmin();
  assertWorkspaceMutable(workspace.id);
  await markDuplicate(formText(formData, "requestId"), formText(formData, "duplicateOfTicketId"), workspace.id);

  revalidatePath("/");
  revalidatePath("/review");
  redirect("/review");
}

export async function updateTicketAction(formData: FormData) {
  const { workspace } = await requireAdmin();
  assertWorkspaceMutable(workspace.id);
  const input = ticketUpdateSchema.parse({
    ticketId: formText(formData, "ticketId"),
    status: formText(formData, "status"),
    department: formText(formData, "department"),
    resolutionNotes: formText(formData, "resolutionNotes"),
    note: formText(formData, "note"),
  });
  await updateTicket(input, workspace.id);

  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath(`/tickets/${input.ticketId}`);
  redirect(`/tickets/${input.ticketId}`);
}

export async function resetWorkspaceDataAction() {
  const { workspace } = await requireOwner();
  assertWorkspaceMutable(workspace.id);
  await resetWorkspaceData(workspace.id);

  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/tickets");
  redirect("/");
}

export async function signInAction(formData: FormData) {
  let redirectTo = "/onboarding";
  try {
    const credentials = loginCredentialsSchema.parse({
      email: formText(formData, "email"),
      password: formText(formData, "password"),
    });
    await signInWithEmail(credentials);
    redirectTo = sanitizeInternalRedirect(formText(formData, "next")) ?? getPostAuthWorkspacePath();
  } catch (error) {
    const next = sanitizeInternalRedirect(formText(formData, "next"));
    redirectWithError(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`, error);
  }
  redirect(redirectTo);
}

export async function signUpAction(formData: FormData) {
  let redirectTo = "/signup/check-email";
  const next = sanitizeInternalRedirect(formText(formData, "next"));
  try {
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

export async function completeEmailVerificationFromTokensAction(formData: FormData) {
  try {
    const accessToken = formText(formData, "accessToken");
    const refreshToken = formText(formData, "refreshToken");

    if (!accessToken || !refreshToken) {
      throw new Error("Verification link is missing a session token.");
    }

    await completeEmailVerificationFromTokens({ accessToken, refreshToken });
    return { redirectTo: getPostVerificationRedirect(formText(formData, "next")) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email verification failed.";
    return { error: message };
  }
}

export async function signOutAction() {
  await clearSessionCookies();
  redirect("/login");
}

export async function updateUserRoleAction(formData: FormData) {
  const { user: actor, workspace } = await requireOwner();
  assertWorkspaceMutable(workspace.id);
  const input = userRoleUpdateSchema.parse({
    userId: formText(formData, "userId"),
    role: formText(formData, "role"),
  });
  await updateWorkspaceMemberRole(workspace.id, input.userId, input.role, actor.id);

  revalidatePath("/users");
  redirect("/users");
}

export async function createWorkspaceDepartmentAction(formData: FormData) {
  const { workspace, membership } = await requireAdmin();
  try {
    const input = workspaceDepartmentCreateSchema.parse({
      workspaceId: workspace.id,
      id: formText(formData, "id"),
      name: formText(formData, "name"),
      description: formText(formData, "description"),
    });
    await createWorkspaceDepartment(input, membership.role);
    revalidatePath("/settings");
  } catch (error) {
    redirectWithError("/settings", error);
  }
  redirect("/settings");
}

export async function deleteWorkspaceDepartmentAction(formData: FormData) {
  const { workspace, membership } = await requireAdmin();
  try {
    const input = workspaceDepartmentDeleteSchema.parse({
      workspaceId: workspace.id,
      id: formText(formData, "id"),
    });
    await deleteWorkspaceDepartment(input, membership.role);
    revalidatePath("/settings");
  } catch (error) {
    redirectWithError("/settings", error);
  }
  redirect("/settings");
}

export async function createWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  let redirectTo = "/onboarding";
  try {
    const access = await createWorkspace(formText(formData, "name"), user.id);
    await setActiveWorkspaceCookie(access.workspace.slug);
    redirectTo = `/w/${access.workspace.slug}`;
  } catch (error) {
    redirectWithError("/onboarding", error);
  }
  redirect(redirectTo);
}

export async function joinWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const workspaceSlug = formText(formData, "workspaceSlug");
  const code = formText(formData, "code");
  let redirectTo = "/onboarding";

  try {
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
  const user = await requireUser();
  const returnPath = "/users";
  try {
    await removeWorkspaceMember(formText(formData, "workspaceId"), formText(formData, "memberUserId"), user.id);
    revalidatePath("/users");
    revalidatePath("/onboarding");
  } catch (error) {
    redirectWithError(returnPath, error);
  }
  redirect(returnPath);
}

export async function deleteWorkspaceAction(formData: FormData) {
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
  const user = await requireUser();
  const workspaceSlug = workspaceSlugSchema.parse(formText(formData, "workspaceSlug"));
  const access = await requireWorkspaceMembership(workspaceSlug, user.id);
  await setActiveWorkspaceCookie(workspaceSlug);
  redirect(isWorkspacePreview(access.workspace.id) || access.membership.role !== "requester" ? "/" : "/tickets");
}
