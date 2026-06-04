import { TicketListView } from "@/app/tickets/page";

export const dynamic = "force-dynamic";

export default async function WorkspaceTickets({ params, searchParams }: { params: Promise<{ workspaceSlug: string }>; searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const { workspaceSlug } = await params;
  return <TicketListView searchParams={searchParams} workspaceSlug={workspaceSlug} />;
}
