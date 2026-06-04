import { UsersPageView } from "@/app/users/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceUsers({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  return <UsersPageView workspaceSlug={workspaceSlug} />;
}
