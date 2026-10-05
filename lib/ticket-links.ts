import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export interface TicketRouteState {
  filter: string;
  q: string;
  page: number;
  priority: string;
  dept: string;
  assignee: string;
}

export function ticketsHref(
  workspaceSlug: string | undefined,
  current: TicketRouteState,
  next: { filter?: string; q?: string; page?: number; priority?: string; dept?: string; assignee?: string }
) {
  const nextParams = new URLSearchParams();
  nextParams.set("filter", next.filter ?? current.filter);
  const nextQuery = next.q ?? current.q;
  if (nextQuery) nextParams.set("q", nextQuery);
  const nextPriority = next.priority ?? current.priority;
  if (nextPriority && nextPriority !== "all") nextParams.set("priority", nextPriority);
  const nextDept = next.dept ?? current.dept;
  if (nextDept && nextDept !== "all") nextParams.set("dept", nextDept);
  const nextAssignee = next.assignee ?? current.assignee;
  if (nextAssignee && nextAssignee !== "all") nextParams.set("assignee", nextAssignee);
  nextParams.set("page", String(next.page ?? current.page));
  return scopedWorkspaceHref(workspaceSlug, `/tickets?${nextParams.toString()}`);
}
