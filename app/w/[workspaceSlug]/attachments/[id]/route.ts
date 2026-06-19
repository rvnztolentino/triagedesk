import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/lib/auth";
import { getVisibleRequestAttachment } from "@/lib/store";
import { requireSupabaseAdminClient } from "@/lib/supabase";
import { enforceRateLimit, RateLimitError } from "@/lib/security";

export const dynamic = "force-dynamic";

function attachmentBucket() {
  return process.env.SUPABASE_REQUEST_ATTACHMENTS_BUCKET || process.env.SUPABASE_REQUEST_IMAGES_BUCKET || "request-attachments";
}

export async function GET(_: Request, { params }: { params: Promise<{ workspaceSlug: string; id: string }> }) {
  const { workspaceSlug, id } = await params;
  const { user, workspace, membership } = await requireWorkspaceContext(workspaceSlug);
  try {
    await enforceRateLimit({
      scope: "attachment_download_user_hour",
      keyParts: [user.id, workspace.id],
      limit: 60,
      windowSeconds: 60 * 60,
      message: "Attachment download limit reached. Try again later.",
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return new NextResponse(error.message, { status: 429 });
    }
    throw error;
  }
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  const attachment = await getVisibleRequestAttachment(id, isAdmin ? undefined : user.id, workspace.id);

  if (!attachment) {
    return new NextResponse("Attachment not found", { status: 404 });
  }

  const client = requireSupabaseAdminClient();
  const { data, error } = await client.storage.from(attachmentBucket()).createSignedUrl(attachment.storagePath, 60, {
    download: attachment.fileName,
  });

  if (error || !data?.signedUrl) {
    return new NextResponse("Attachment unavailable", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
