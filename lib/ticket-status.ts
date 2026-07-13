import type { TicketStatus } from "@/lib/schema";

const statusStyles: Record<TicketStatus, { badge: string; indicator: string }> = {
  new: {
    badge: "st-neutral",
    indicator: "ind-neutral",
  },
  open: {
    badge: "st-info",
    indicator: "ind-info",
  },
  "in-progress": {
    badge: "st-active",
    indicator: "ind-active animate-pulse",
  },
  resolved: {
    badge: "st-done",
    indicator: "ind-done",
  },
  closed: {
    badge: "st-neutral",
    indicator: "ind-closed",
  },
};

export function ticketStatusBadgeClass(status: TicketStatus) {
  return statusStyles[status].badge;
}

export function ticketStatusIndicatorClass(status: TicketStatus) {
  return statusStyles[status].indicator;
}
