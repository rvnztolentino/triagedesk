"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { TicketSearch } from "./ticket-search";
import { cn } from "@/lib/utils";
import { ticketsHref, type TicketRouteState } from "@/lib/ticket-links";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function isModifiedClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function matchesCurrentLocation(href: string) {
  const nextUrl = new URL(href, window.location.origin);
  return nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search;
}

function normalizedPage(value: string | null) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function matchesCurrentRouteState(href: string, current: TicketRouteState) {
  const nextUrl = new URL(href, window.location.origin);
  const nextFilter = nextUrl.searchParams.get("filter") || "all";
  const nextQuery = (nextUrl.searchParams.get("q") || "").trim();
  const nextPage = normalizedPage(nextUrl.searchParams.get("page"));
  const nextPriority = nextUrl.searchParams.get("priority") || "all";
  const nextDept = nextUrl.searchParams.get("dept") || "all";
  return (
    nextFilter === current.filter &&
    nextQuery === current.q &&
    nextPage === current.page &&
    nextPriority === current.priority &&
    nextDept === current.dept
  );
}

export function TicketsTableSkeleton() {
  return (
    <div className="card table-scroll">
      <div className="list">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="row-link" style={{ cursor: "default" }}>
            <div className="data-row" style={{ gridTemplateColumns: "92px 1fr auto" }}>
              <div className="h-3.5 w-14 animate-pulse rounded bg-surface-hover" />
              <div>
                <div className="h-4 w-52 animate-pulse rounded bg-surface-hover" />
                <div className="mt-2 h-3 w-64 animate-pulse rounded bg-surface-hover" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-16 animate-pulse rounded-full bg-surface-hover" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-surface-hover" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TicketsTableShell({
  filter,
  query,
  requestedPage,
  priority,
  dept,
  departments,
  workspaceSlug,
  children,
}: {
  filter: string;
  query: string;
  requestedPage: number;
  priority: string;
  dept: string;
  departments: { id: string; name: string }[];
  workspaceSlug?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [tableLoading, setTableLoading] = React.useState(false);
  const [optimisticFilter, setOptimisticFilter] = React.useState(filter);
  const current = React.useMemo<TicketRouteState>(
    () => ({ filter, q: query, page: requestedPage, priority, dept }),
    [filter, query, requestedPage, priority, dept]
  );

  // Clear the skeleton the moment new route state arrives from the server. Done
  // during render (not in an effect) so it happens in one pass.
  const routeKey = `${filter} ${query} ${requestedPage} ${priority} ${dept}`;
  const [seenRouteKey, setSeenRouteKey] = React.useState(routeKey);
  if (routeKey !== seenRouteKey) {
    setSeenRouteKey(routeKey);
    setTableLoading(false);
    setOptimisticFilter(filter);
  }

  React.useEffect(() => {
    if (!tableLoading) return;
    const timeout = window.setTimeout(() => {
      setTableLoading(false);
      setOptimisticFilter(filter);
    }, 10000);
    return () => window.clearTimeout(timeout);
  }, [filter, tableLoading]);

  function isCurrentHref(href: string) {
    return matchesCurrentLocation(href) || matchesCurrentRouteState(href, current);
  }

  function handleNavigate(event: React.MouseEvent<HTMLAnchorElement>, href: string, nextFilter: string) {
    if (event.defaultPrevented || isModifiedClick(event) || event.currentTarget.target === "_blank" || isCurrentHref(href)) return;
    setOptimisticFilter(nextFilter);
    setTableLoading(true);
  }

  const handleSearchNavigate = React.useCallback((href: string) => {
    if (matchesCurrentLocation(href)) return;
    setTableLoading(true);
  }, []);

  function handleSelectNavigate(href: string) {
    if (isCurrentHref(href)) return;
    setTableLoading(true);
    router.push(href);
  }

  return (
    <div aria-busy={tableLoading ? true : undefined}>
      <div className="filter-bar" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <div className="seg-filter">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["resolved", "Resolved"],
          ].map(([value, label]) => {
            const href = ticketsHref(workspaceSlug, current, { filter: value, page: 1 });
            return (
              <Link
                key={value}
                href={href}
                onClick={(event) => handleNavigate(event, href, value)}
                className={optimisticFilter === value ? "on" : ""}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="cluster wrap" style={{ gap: 10, justifyContent: "flex-end" }}>
          <TicketSearch query={query} onNavigate={handleSearchNavigate} />
          <select
            className="select"
            style={{ width: "auto" }}
            value={priority}
            onChange={(event) => handleSelectNavigate(ticketsHref(workspaceSlug, current, { priority: event.target.value, page: 1 }))}
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: "auto" }}
            value={dept}
            onChange={(event) => handleSelectNavigate(ticketsHref(workspaceSlug, current, { dept: event.target.value, page: 1 }))}
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={cn(tableLoading && "opacity-60")}>{tableLoading ? <TicketsTableSkeleton /> : children}</div>
    </div>
  );
}
