"use client";

import Link from "next/link";
import React from "react";
import { TicketSearch } from "./ticket-search";
import { cn } from "@/lib/utils";
import { ticketsHref, type TicketRouteState } from "@/lib/ticket-links";

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
  return nextFilter === current.filter && nextQuery === current.q && nextPage === current.page;
}

export function TicketsTableSkeleton() {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0d0d0d] border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
              <th className="font-semibold p-6 w-28">ID</th>
              <th className="font-semibold p-6">Details</th>
              <th className="font-semibold p-6">Status</th>
              <th className="font-semibold p-6">Department</th>
              <th className="font-semibold p-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {Array.from({ length: 5 }).map((_, index) => (
              <tr key={index}>
                <td className="p-6">
                  <div className="h-4 w-20 animate-pulse rounded bg-neutral-800" />
                </td>
                <td className="p-6">
                  <div className="h-4 w-56 animate-pulse rounded bg-neutral-800" />
                  <div className="mt-3 h-3 w-72 animate-pulse rounded bg-neutral-800/70" />
                </td>
                <td className="p-6">
                  <div className="h-4 w-28 animate-pulse rounded bg-neutral-800" />
                </td>
                <td className="p-6">
                  <div className="h-6 w-24 animate-pulse rounded-md bg-neutral-800" />
                </td>
                <td className="p-6">
                  <div className="ml-auto h-8 w-8 animate-pulse rounded-lg bg-neutral-800" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-6 border-t border-neutral-800 flex flex-col gap-4 text-sm md:flex-row md:items-center md:justify-between">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-800" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-neutral-800" />
      </div>
    </>
  );
}

export function TicketsTableShell({
  filter,
  query,
  requestedPage,
  workspaceSlug,
  children,
}: {
  filter: string;
  query: string;
  requestedPage: number;
  workspaceSlug?: string;
  children: React.ReactNode;
}) {
  const [tableLoading, setTableLoading] = React.useState(false);
  const [optimisticFilter, setOptimisticFilter] = React.useState(filter);
  const navigationStarted = React.useRef(false);
  const current = React.useMemo<TicketRouteState>(() => ({ filter, q: query, page: requestedPage }), [filter, query, requestedPage]);

  React.useEffect(() => {
    if (!tableLoading) return;
    const timeout = window.setTimeout(() => {
      navigationStarted.current = false;
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
    navigationStarted.current = true;
    setOptimisticFilter(nextFilter);
    setTableLoading(true);
  }

  const handleSearchNavigate = React.useCallback((href: string) => {
    if (matchesCurrentLocation(href)) return;
    navigationStarted.current = true;
    setTableLoading(true);
  }, []);

  return (
    <div className="bg-[#111111] rounded-2xl shadow-xl border border-neutral-800 overflow-hidden" aria-busy={tableLoading ? true : undefined}>
      <div className="flex items-center justify-between p-6 border-b border-neutral-800 gap-4 flex-wrap bg-[#151515]">
        <div className="flex items-center gap-2 bg-[#0a0a0a] p-1 rounded-xl border border-neutral-800">
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
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                  optimisticFilter === value ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <TicketSearch query={query} onNavigate={handleSearchNavigate} />
      </div>

      {tableLoading ? <TicketsTableSkeleton /> : children}
    </div>
  );
}
