import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export interface TicketRouteState {
  filter: string;
  q: string;
  page: number;
}

export function ticketsHref(
  workspaceSlug: string | undefined,
  current: TicketRouteState,
  next: { filter?: string; q?: string; page?: number }
) {
  const nextParams = new URLSearchParams();
  nextParams.set("filter", next.filter ?? current.filter);
  const nextQuery = next.q ?? current.q;
  if (nextQuery) nextParams.set("q", nextQuery);
  nextParams.set("page", String(next.page ?? current.page));
  return scopedWorkspaceHref(workspaceSlug, `/tickets?${nextParams.toString()}`);
}
