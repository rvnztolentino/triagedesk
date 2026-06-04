import { SubmitConfirmView } from "@/app/submit/confirm/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceRequestDetail({ params }: { params: Promise<{ workspaceSlug: string; id: string }> }) {
  const { workspaceSlug, id } = await params;
  return <SubmitConfirmView workspaceSlug={workspaceSlug} requestId={id} />;
}
