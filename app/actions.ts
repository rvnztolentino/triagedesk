"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginCredentialsSchema, requestSubmissionSchema, reviewApprovalSchema, ticketUpdateSchema, userRoleUpdateSchema } from "@/lib/schema";
import {
  clearSessionCookies,
  completeEmailVerificationFromTokens,
  getPostVerificationRedirect,
  requireAdmin,
  requireOwner,
  requireUser,
  signInWithEmail,
  signUpWithEmail,
  updateUserRole,
} from "@/lib/auth";
import { requireSupabaseAdminClient } from "@/lib/supabase";
import { runTriage } from "@/lib/triage";
import {
  approveRequest,
  createRequest,
  findReusableTriageDraft,
  getSimilarTickets,
  markDuplicate,
  rejectRequest,
  resetWorkspaceData,
  saveTriageResult,
  updateTicket,
} from "@/lib/store";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithError(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function fileExtension(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return match?.[0] ?? ".jpg";
}

function validateRequestImage(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image uploads must be 5 MB or smaller.");
  }

  return file;
}

async function saveRequestImage(file: File | null) {
  if (!file) {
    return undefined;
  }

  const client = requireSupabaseAdminClient();
  const bucket = process.env.SUPABASE_REQUEST_IMAGES_BUCKET || "request-images";
  const storagePath = `requests/${Date.now()}-${crypto.randomUUID()}${fileExtension(file.name)}`;
  const { error } = await client.storage.from(bucket).upload(storagePath, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function submitRequestAction(formData: FormData) {
  const user = await requireUser();
  const input = requestSubmissionSchema.parse({
    description: formText(formData, "description"),
    location: formText(formData, "location"),
    contactName: formText(formData, "contactName"),
    urgencyNote: formText(formData, "urgencyNote"),
  });
  requireSupabaseAdminClient();
  const image = formData.get("image");
  const imageFile = validateRequestImage(image instanceof File ? image : null);
  const similarTickets = await getSimilarTickets(`${input.description} ${input.location} ${input.urgencyNote}`);
  const reusableTriage = await findReusableTriageDraft(input);
  const triage = reusableTriage
    ? {
        ...reusableTriage,
        similarTicketIds: similarTickets.slice(0, 3).map((ticket) => ticket.id),
      }
    : await runTriage({ ...input, similarTickets });
  const imageUrl = await saveRequestImage(imageFile);
  const request = await createRequest(input, imageUrl, user);
  await saveTriageResult(request.id, triage);

  revalidatePath("/");
  revalidatePath("/review");
  redirect(`/submit/confirm?id=${request.id}`);
}

export async function approveRequestAction(formData: FormData) {
  await requireAdmin();
  const input = reviewApprovalSchema.parse({
    requestId: formText(formData, "requestId"),
    title: formText(formData, "title"),
    priority: formText(formData, "priority"),
    department: formText(formData, "department"),
    summary: formText(formData, "summary"),
  });
  const ticket = await approveRequest(input);

  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function rejectRequestAction(formData: FormData) {
  await requireAdmin();
  await rejectRequest(formText(formData, "requestId"));

  revalidatePath("/");
  revalidatePath("/review");
  redirect("/review");
}

export async function markDuplicateAction(formData: FormData) {
  await requireAdmin();
  await markDuplicate(formText(formData, "requestId"), formText(formData, "duplicateOfTicketId"));

  revalidatePath("/");
  revalidatePath("/review");
  redirect("/review");
}

export async function updateTicketAction(formData: FormData) {
  await requireAdmin();
  const input = ticketUpdateSchema.parse({
    ticketId: formText(formData, "ticketId"),
    status: formText(formData, "status"),
    department: formText(formData, "department"),
    resolutionNotes: formText(formData, "resolutionNotes"),
    note: formText(formData, "note"),
  });
  await updateTicket(input);

  revalidatePath("/");
  revalidatePath("/tickets");
  revalidatePath(`/tickets/${input.ticketId}`);
  redirect(`/tickets/${input.ticketId}`);
}

export async function resetWorkspaceDataAction() {
  await requireOwner();
  await resetWorkspaceData();

  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/tickets");
  redirect("/");
}

export async function signInAction(formData: FormData) {
  let redirectTo = "/tickets";
  try {
    const credentials = loginCredentialsSchema.parse({
      email: formText(formData, "email"),
      password: formText(formData, "password"),
    });
    const user = await signInWithEmail(credentials);
    redirectTo = user?.role === "admin" || user?.role === "owner" ? "/" : "/tickets";
  } catch (error) {
    redirectWithError("/login", error);
  }
  redirect(redirectTo);
}

export async function signUpAction(formData: FormData) {
  let redirectTo = "/signup/check-email";
  try {
    const result = await signUpWithEmail({
      email: formText(formData, "email"),
      password: formText(formData, "password"),
      displayName: formText(formData, "displayName"),
    });
    redirectTo = `/signup/check-email?email=${encodeURIComponent(result.email)}`;
  } catch (error) {
    redirectWithError("/signup", error);
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

    const user = await completeEmailVerificationFromTokens({ accessToken, refreshToken });
    return { redirectTo: getPostVerificationRedirect(user) };
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
  const actor = await requireOwner();
  const input = userRoleUpdateSchema.parse({
    userId: formText(formData, "userId"),
    role: formText(formData, "role"),
  });
  await updateUserRole(actor, input.userId, input.role);

  revalidatePath("/users");
  redirect("/users");
}
