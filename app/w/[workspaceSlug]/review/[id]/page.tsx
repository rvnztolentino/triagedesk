import { ReviewDetailView } from "@/app/review/[id]/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceReviewDetail({ params }: { params: Promise<{ workspaceSlug: string; id: string }> }) {
  const { workspaceSlug, id } = await params;
  return <ReviewDetailView params={Promise.resolve({ id })} workspaceSlug={workspaceSlug} />;
}
