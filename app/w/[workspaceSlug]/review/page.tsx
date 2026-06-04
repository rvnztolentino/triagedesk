import { ReviewQueueView } from "@/app/review/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceReviewQueue({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  return <ReviewQueueView workspaceSlug={workspaceSlug} />;
}
