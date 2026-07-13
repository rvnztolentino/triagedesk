import { NotificationsPageView } from "@/app/notifications/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceNotifications({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  return <NotificationsPageView workspaceSlug={workspaceSlug} />;
}
