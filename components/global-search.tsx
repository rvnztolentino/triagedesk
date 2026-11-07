"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import type { SearchPage } from "@/components/global-search-dialog";
import { cn } from "@/lib/utils";

// The palette is code-split out of the app shell and fetched on first open. Hovering
// or focusing the trigger warms the chunk so a click opens it without a visible wait.
const loadDialog = () => import("@/components/global-search-dialog");
const GlobalSearchDialog = dynamic(() => loadDialog().then((m) => m.GlobalSearchDialog), { ssr: false });

const noSubscribe = () => () => {};
function readShortcutLabel() {
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
}

export function GlobalSearch({
  pages,
  workspaceSlug,
  collapsed,
  onNavigate,
}: {
  pages: SearchPage[];
  workspaceSlug: string;
  collapsed: boolean;
  onNavigate: (href: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  // Null on the server, so the hint renders once on the client instead of guessing
  // the platform and mismatching on hydration.
  const shortcut = React.useSyncExternalStore(noSubscribe, readShortcutLabel, () => null);

  const show = React.useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMounted(true);
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={show}
        onPointerEnter={loadDialog}
        onFocus={loadDialog}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        title={collapsed ? `Search${shortcut ? ` (${shortcut})` : ""}` : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-surface shadow-(--control-shadow) px-3 py-2 text-sm text-faint transition-colors duration-200 hover:border-border-strong hover:text-fg",
          collapsed && "md:justify-center md:px-0"
        )}
      >
        <Search size={15} className="shrink-0" />
        <span className={cn("flex-1 text-left", collapsed && "md:hidden")}>Search</span>
        {shortcut ? <kbd className={cn("kbd", collapsed && "md:hidden")}>{shortcut}</kbd> : null}
      </button>
      {mounted ? (
        <GlobalSearchDialog
          open={open}
          onClose={() => setOpen(false)}
          pages={pages}
          workspaceSlug={workspaceSlug}
          onNavigate={onNavigate}
        />
      ) : null}
    </>
  );
}
