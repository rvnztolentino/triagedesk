import { TicketDetailView } from "@/app/tickets/[id]/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceTicketDetail({ params }: { params: Promise<{ workspaceSlug: string; id: string }> }) {
  const { workspaceSlug, id } = await params;
  return <TicketDetailView params={Promise.resolve({ id })} workspaceSlug={workspaceSlug} />;
}
