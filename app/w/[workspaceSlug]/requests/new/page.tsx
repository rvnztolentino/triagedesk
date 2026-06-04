import { SubmitRequestView } from "@/app/submit/page";

export default async function WorkspaceNewRequest({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  return <SubmitRequestView workspaceSlug={workspaceSlug} />;
}
