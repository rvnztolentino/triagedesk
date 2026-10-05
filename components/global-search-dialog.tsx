"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search, Ticket, type LucideIcon } from "lucide-react";
import { searchWorkspaceAction } from "@/app/actions";
import type { GlobalSearchTicket } from "@/lib/schema";
import { ticketsHref } from "@/lib/ticket-links";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export interface SearchPage {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SearchResult {
  term: string;
  tickets: GlobalSearchTicket[];
  error?: string;
}

interface Option {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  prefix?: string;
  meta?: string;
  group: "Pages" | "Tickets";
}

const SEARCH_DEBOUNCE_MS = 200;
const MIN_TERM_LENGTH = 2;
const EMPTY_RESULT: SearchResult = { term: "", tickets: [] };

export function GlobalSearchDialog({
  open,
  onClose,
  pages,
  workspaceSlug,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  pages: SearchPage[];
  workspaceSlug: string;
  onNavigate: (href: string) => void;
}) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestRef = React.useRef(0);
  // Per-open cache so backspacing over a term already searched does not refetch.
  const cacheRef = React.useRef(new Map<string, SearchResult>());
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<SearchResult>(EMPTY_RESULT);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const term = query.trim();
  const searching = term.length >= MIN_TERM_LENGTH;
  const loading = searching && result.term !== term;

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  React.useEffect(() => {
    const id = ++requestRef.current;
    if (!searching) return;
    const cached = cacheRef.current.get(term);
    if (cached) {
      setResult(cached);
      return;
    }
    const timer = window.setTimeout(async () => {
      const next = await searchWorkspaceAction(term).catch(() => ({ tickets: [], error: "Search is unavailable right now." }));
      const entry = { term, ...next };
      if (!next.error) cacheRef.current.set(term, entry);
      // Drop responses that arrive after the user has typed past them.
      if (id === requestRef.current) setResult(entry);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term, searching]);

  const options = React.useMemo<Option[]>(() => {
    const needle = term.toLowerCase();
    const pageOptions: Option[] = pages
      .filter((page) => page.label.toLowerCase().includes(needle))
      .map((page) => ({ key: `page:${page.href}`, href: page.href, icon: page.icon, label: page.label, group: "Pages" }));
    if (!searching) return pageOptions;

    // While a new term loads, the previous term's tickets stay up so the list does not flash empty.
    const ticketOptions: Option[] = result.tickets.map((ticket) => ({
      key: `ticket:${ticket.id}`,
      href: scopedWorkspaceHref(workspaceSlug, `/tickets/${ticket.id}`),
      icon: Ticket,
      prefix: ticket.id,
      label: ticket.title,
      meta: ticket.status.replace("-", " "),
      group: "Tickets",
    }));
    const allTickets: Option = {
      key: "all-tickets",
      href: ticketsHref(workspaceSlug, { filter: "all", q: "", page: 1, priority: "all", dept: "all", assignee: "all" }, { q: term }),
      icon: Search,
      label: `Search all tickets for "${term}"`,
      group: "Tickets",
    };
    return [...pageOptions, ...ticketOptions, allTickets];
  }, [pages, term, searching, result, workspaceSlug]);

  const active = Math.min(activeIndex, Math.max(options.length - 1, 0));

  React.useEffect(() => {
    document.getElementById(`search-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function reset() {
    setQuery("");
    setResult(EMPTY_RESULT);
    setActiveIndex(0);
    cacheRef.current.clear();
  }

  function go(href: string) {
    onNavigate(href);
    onClose();
    router.push(href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((active + step + options.length) % options.length);
    } else if (event.key === "Enter" && options[active]) {
      event.preventDefault();
      go(options[active].href);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      aria-label="Search"
      onClose={() => {
        reset();
        onClose();
      }}
      // A click that lands on the dialog element itself is on the backdrop.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-field">
        {loading ? <Loader2 size={17} className="spin shrink-0" /> : <Search size={17} className="shrink-0" />}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-listbox"
          aria-activedescendant={options.length > 0 ? `search-option-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          maxLength={80}
          placeholder="Search pages and tickets"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <kbd className="kbd">Esc</kbd>
      </div>

      <div id="search-listbox" role="listbox" aria-label="Results" className="search-results">
        {options.map((option, index) => (
          <React.Fragment key={option.key}>
            {index === 0 || options[index - 1].group !== option.group ? (
              <div className="search-group" role="presentation">{option.group}</div>
            ) : null}
            <div
              id={`search-option-${index}`}
              role="option"
              aria-selected={index === active}
              className="search-option"
              onMouseMove={() => index !== active && setActiveIndex(index)}
              onClick={() => go(option.href)}
            >
              <option.icon size={15} />
              {option.prefix ? <span className="mono faint text-[11.5px]">{option.prefix}</span> : null}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.meta ? <span className="mono faint text-[11.5px]">{option.meta}</span> : null}
              {index === active ? <CornerDownLeft size={13} /> : null}
            </div>
          </React.Fragment>
        ))}
        {result.error && result.term === term ? (
          <div className="search-note" role="status">{result.error}</div>
        ) : searching && !loading && result.tickets.length === 0 ? (
          <div className="search-note" role="status">No tickets match &ldquo;{term}&rdquo;.</div>
        ) : null}
      </div>

      <div className="search-foot" aria-hidden>
        <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move</span>
        <span><kbd className="kbd">Enter</kbd> to open</span>
      </div>
    </dialog>
  );
}
