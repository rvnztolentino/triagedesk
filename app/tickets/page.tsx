import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, Building2, Ticket } from "lucide-react";
import { requireWorkspaceContext } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listDepartments, listTickets } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";
import { ticketsHref } from "@/lib/ticket-links";
import { TicketsTableShell, TicketsTableSkeleton } from "./tickets-table-shell";

export const dynamic = "force-dynamic";

const TICKETS_PER_PAGE = 10;

const PRIORITY_HUE: Record<string, string> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "danger",
};

const STATUS_HUE: Record<string, string> = {
  new: "neutral",
  open: "info",
  "in-progress": "active",
  resolved: "done",
  closed: "neutral",
};

interface TicketParams {
  filter?: string;
  q?: string;
  page?: string;
  priority?: string;
  dept?: string;
}

function normalizeSearch(value: string | undefined) {
  return (value ?? "").trim();
}

function pageNumber(value: string | undefined) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function TicketTable({
  filter,
  query,
  requestedPage,
  priority,
  dept,
  deptNames,
  isAdmin,
  userId,
  workspaceId,
  workspaceSlug,
}: {
  filter: string;
  query: string;
  requestedPage: number;
  priority: string;
  dept: string;
  deptNames: Record<string, string>;
  isAdmin: boolean;
  userId: string;
  workspaceId: string;
  workspaceSlug?: string;
}) {
  const tickets = await listTickets(filter, isAdmin ? undefined : userId, workspaceId);
  const normalizedQuery = query.toLowerCase();
  const filteredTickets = tickets
    .filter((ticket) => priority === "all" || ticket.priority === priority)
    .filter((ticket) => dept === "all" || ticket.department === dept)
    .filter((ticket) =>
      !normalizedQuery
        ? true
        : [ticket.id, ticket.title, ticket.description, ticket.location, ticket.status, ticket.department, ticket.priority]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
    );
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * TICKETS_PER_PAGE;
  const visibleTickets = filteredTickets.slice(pageStart, pageStart + TICKETS_PER_PAGE);
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;
  const hasFilters = query.length > 0 || priority !== "all" || dept !== "all" || filter !== "all";
  const current = { filter, q: query, page: currentPage, priority, dept };

  return (
    <>
      {visibleTickets.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-glyph">
              <Ticket size={22} />
            </div>
            <div style={{ fontWeight: 600, color: "var(--fg)" }}>
              {isSetupRequired ? "Setup required" : hasFilters ? "No tickets match" : "No tickets found"}
            </div>
            <div style={{ maxWidth: "40ch", fontSize: 13.5 }}>
              {isSetupRequired
                ? "Database and AI triage configuration must be completed."
                : hasFilters
                  ? "Try clearing filters or a different search."
                  : isAdmin
                    ? "Tickets will appear here after requests are approved."
                    : "Your approved requests will appear here as tickets."}
            </div>
          </div>
        </div>
      ) : (
        <div className="card list">
          {visibleTickets.map((ticket) => (
            <Link key={ticket.id} href={scopedWorkspaceHref(workspaceSlug, `/tickets/${ticket.id}`)} className="row-link">
              <div className="data-row" style={{ gridTemplateColumns: "84px 1fr auto" }}>
                <span className="mono faint" style={{ fontSize: 12 }}>
                  {ticket.id}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{ticket.title}</div>
                  <div className="cluster wrap" style={{ gap: 10, marginTop: 5 }}>
                    <span className="chip" style={{ padding: "2px 8px", fontSize: 11 }}>
                      <Building2 size={11} /> {deptNames[ticket.department] ?? capitalize(ticket.department)}
                    </span>
                    <span className="faint" style={{ fontSize: 11.5 }}>
                      {ticket.location || "No location"} · updated {formatDate(ticket.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="cluster" style={{ gap: 10 }}>
                  <span className="hide-sm">
                    <span className="badge" data-hue={PRIORITY_HUE[ticket.priority] ?? "neutral"}>
                      <span className="dot" /> {ticket.priority}
                    </span>
                  </span>
                  <span className="badge" data-hue={STATUS_HUE[ticket.status] ?? "neutral"}>
                    <span className="dot" /> {ticket.status.replace("-", " ")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="between wrap" style={{ marginTop: 6, gap: 12 }}>
          <span className="mono faint" style={{ fontSize: 12 }}>
            Showing {pageStart + 1}-{Math.min(pageStart + visibleTickets.length, filteredTickets.length)} of {filteredTickets.length}
          </span>
          <div className="cluster" style={{ gap: 8 }}>
            <Link
              aria-disabled={currentPage <= 1}
              href={ticketsHref(workspaceSlug, current, { page: Math.max(1, currentPage - 1) })}
              className="btn btn--sm"
              style={currentPage <= 1 ? { opacity: 0.5, pointerEvents: "none" } : undefined}
            >
              <ArrowLeft size={14} /> Prev
            </Link>
            <span className="mono faint" style={{ fontSize: 12 }}>
              Page {currentPage} of {totalPages}
            </span>
            <Link
              aria-disabled={currentPage >= totalPages}
              href={ticketsHref(workspaceSlug, current, { page: Math.min(totalPages, currentPage + 1) })}
              className="btn btn--sm"
              style={currentPage >= totalPages ? { opacity: 0.5, pointerEvents: "none" } : undefined}
            >
              Next <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}

export async function TicketListView({ searchParams, workspaceSlug }: { searchParams: Promise<TicketParams>; workspaceSlug?: string }) {
  const { user, workspace, membership } = await requireWorkspaceContext(workspaceSlug);
  const params = await searchParams;
  const filter = params.filter || "all";
  const query = normalizeSearch(params.q);
  const requestedPage = pageNumber(params.page);
  const priority = params.priority || "all";
  const dept = params.dept || "all";
  const isAdmin = isWorkspacePreview(workspace.id) || membership.role === "admin" || membership.role === "owner";
  const departments = await listDepartments(workspace.id);
  const deptOptions = departments.map((d) => ({ id: d.id, name: d.name }));
  const deptNames = Object.fromEntries(deptOptions.map((d) => [d.id, d.name]));

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5">
      <div className="page-head">
        <div className="eyebrow">{isAdmin ? "All tickets" : "My tickets"}</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {isAdmin ? "Ticket board" : "Tickets you submitted"}
        </h1>
        <p className="page-sub">
          {isAdmin ? "Manage and track all operations requests." : "Track requests submitted from your account."}
        </p>
      </div>

      <TicketsTableShell
        filter={filter}
        query={query}
        requestedPage={requestedPage}
        priority={priority}
        dept={dept}
        departments={deptOptions}
        workspaceSlug={workspaceSlug}
      >
        <Suspense key={`${filter}:${query}:${requestedPage}:${priority}:${dept}`} fallback={<TicketsTableSkeleton />}>
          <TicketTable
            filter={filter}
            query={query}
            requestedPage={requestedPage}
            priority={priority}
            dept={dept}
            deptNames={deptNames}
            isAdmin={isAdmin}
            userId={user.id}
            workspaceId={workspace.id}
            workspaceSlug={workspaceSlug}
          />
        </Suspense>
      </TicketsTableShell>
    </div>
  );
}

export default async function TicketList({ searchParams }: { searchParams: Promise<TicketParams> }) {
  return <TicketListView searchParams={searchParams} />;
}
