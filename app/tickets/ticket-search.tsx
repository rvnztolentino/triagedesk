"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

interface TicketSearchProps {
  query: string;
}

export function TicketSearch({ query }: TicketSearchProps) {
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

      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams, value]);

  return (
    <div className="relative min-w-full flex-1 sm:min-w-[320px]">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type="search"
        placeholder="Search tickets"
        className="h-10 w-full rounded-xl border border-neutral-800 bg-[#0a0a0a] pl-9 pr-3 text-sm text-white placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
      />
    </div>
  );
}
