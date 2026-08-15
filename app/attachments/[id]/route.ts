import { NextResponse } from "next/server";
import { isDemoUser, requireOperationalWorkspace } from "@/lib/auth";
import { getVisibleRequestAttachment } from "@/lib/store";
import { requestAttachmentBucket as attachmentBucket, requireSupabaseAdminClient } from "@/lib/supabase";
import { enforceRateLimit, RateLimitError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, workspace, membership } = await requireOperationalWorkspace();
  // Demo sessions have no attachments of their own (uploads are denied), so any
  // download attempt is either pointless or aimed at someone else's file. Refuse
  // before the signed storage URL is ever minted.
  if (isDemoUser(user)) {
    return new NextResponse("Attachments are available on a real workspace.", { status: 403 });
  }
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
  const { id } = await params;
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
