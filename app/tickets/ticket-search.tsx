"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

interface TicketSearchProps {
  query: string;
  onNavigate?: (href: string) => void;
}

export function TicketSearch({ query, onNavigate }: TicketSearchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());
      const nextQuery = value.trim();

      if (nextQuery === query) return;

      if (nextQuery) {
        nextParams.set("q", nextQuery);
      } else {
        nextParams.delete("q");
      }

      nextParams.set("page", "1");
      const nextUrl = `${pathname}?${nextParams.toString()}`;
      onNavigate?.(nextUrl);

      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [onNavigate, pathname, query, router, searchParams, value]);

  return (
    <div className="relative w-full lg:w-[380px]">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type="search"
        placeholder="Search tickets"
        className="h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-faint focus:border-accent-border focus:outline-none"
      />
    </div>
  );
}
