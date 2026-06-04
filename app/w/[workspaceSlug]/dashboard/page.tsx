import { DashboardView } from "@/app/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceDashboard({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  return <DashboardView workspaceSlug={workspaceSlug} />;
}
