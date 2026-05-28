import type { TicketStatus } from "@/lib/schema";

const statusStyles: Record<TicketStatus, { badge: string; indicator: string }> = {
  new: {
    badge: "border border-neutral-700 bg-neutral-800 text-neutral-400",
    indicator: "bg-neutral-500",
  },
  "needs-review": {
    badge: "border border-amber-500/20 bg-amber-500/10 text-amber-300",
    indicator: "bg-amber-400 animate-pulse",
  },
  open: {
    badge: "border border-blue-500/20 bg-blue-500/10 text-blue-400",
    indicator: "bg-blue-500",
  },
  "in-progress": {
    badge: "border border-violet-500/20 bg-violet-500/10 text-violet-300",
    indicator: "bg-violet-500 animate-pulse",
  },
  resolved: {
    badge: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    indicator: "text-emerald-500",
  },
  closed: {
    badge: "border border-neutral-700 bg-neutral-800 text-neutral-400",
    indicator: "text-neutral-500",
  },
};

export function ticketStatusBadgeClass(status: TicketStatus) {
  return statusStyles[status].badge;
}

export function ticketStatusIndicatorClass(status: TicketStatus) {
  return statusStyles[status].indicator;
}
