"use client";

import React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { fetchNotificationsAction, markNotificationsReadAction } from "@/app/actions";
import type { NotificationView } from "@/lib/schema";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

// How often the bell re-checks for new notifications while the tab is visible.
const POLL_INTERVAL_MS = 30_000;

export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
  workspaceSlug,
}: {
  notifications: NotificationView[];
  unreadCount: number;
  workspaceSlug: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [panelTop, setPanelTop] = React.useState<number | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // Local, live copy of the feed. Seeded from the server-rendered props, then kept
  // fresh by polling. Frozen while the panel is open so the snapshot (and its unread
  // highlights) doesn't reshuffle under the user.
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);

  // Adopt fresh server data on navigation. The layout is a server component, so its
  // props only get a new identity when it re-renders (a navigation / server refresh),
  // not on the bell's own state updates — making this a safe "did navigate" signal.
  const [syncedProps, setSyncedProps] = React.useState(initialNotifications);
  if (syncedProps !== initialNotifications) {
    setSyncedProps(initialNotifications);
    setNotifications(initialNotifications);
    setUnreadCount(initialUnreadCount);
  }

  // Read current `open` inside the polling interval without resetting the timer.
  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  // On mobile the panel renders as a full-width overlay pinned to the bottom of the
  // header (see the `.popover` mobile rules in globals.css). Measure the enclosing
  // header so it drops from the exact header edge — mirroring the appearance popover.
  React.useEffect(() => {
    if (!open) return;

    function measure() {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const header = isMobile ? triggerRef.current?.closest("header, nav") : null;
      setPanelTop(header ? Math.round(header.getBoundingClientRect().bottom) : null);
    }

    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const hasUnread = notifications.some((item) => !item.read);

  const handleOpen = React.useCallback(() => {
    const next = !open;
    setOpen(next);
    // Opening the panel counts as "viewing" — clear the badge and persist the read
    // state on the server. Side effects run here in the click handler (not inside a
    // setState updater, which must stay pure). The list keeps its snapshot so unread
    // rows stay highlighted for this viewing.
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      startTransition(() => {
        void markNotificationsReadAction();
      });
    }
  }, [open, unreadCount]);

  // Poll for new notifications while the tab is visible and the panel is closed,
  // plus an immediate refresh whenever the tab regains focus.
  React.useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (openRef.current || document.visibilityState !== "visible") return;
      const data = await fetchNotificationsAction();
      if (cancelled) return;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }

    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    function handleVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const menu = document.getElementById("app-notif-menu");
      const btn = document.getElementById("app-notif-btn");
      if (menu?.contains(target) || btn?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id="app-notif-btn"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        onClick={handleOpen}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border transition-colors duration-200",
          open ? "border-border-strong bg-surface text-fg" : "border-transparent text-muted hover:border-border hover:bg-surface hover:text-fg"
        )}
      >
        <Bell size={17} />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-bg"
            style={{ background: "var(--danger)" }}
          />
        ) : null}
      </button>

      {open ? (
        <div
          id="app-notif-menu"
          role="menu"
          className="popover"
          style={{ padding: 0, ...(panelTop !== null ? { ["--popover-top"]: `${panelTop}px` } : {}) } as React.CSSProperties}
        >
          <div className="between" style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontWeight: 650, fontSize: 14 }}>Notifications</span>
            {hasUnread ? (
              <span className="cluster" style={{ gap: 5, color: "var(--muted)", fontSize: 12 }}>
                <CheckCheck size={13} /> {isPending ? "Marking…" : "Marked read"}
              </span>
            ) : null}
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto", padding: 6 }}>
            {notifications.length === 0 ? (
              <div className="stack" style={{ alignItems: "center", gap: 8, padding: "28px 16px", textAlign: "center" }}>
                <Bell size={22} style={{ color: "var(--muted)" }} />
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>You&apos;re all caught up</div>
                <div className="muted" style={{ fontSize: 12.5 }}>New activity in this workspace will show up here.</div>
              </div>
            ) : (
              notifications.map((item) => {
                const href = item.link ? scopedWorkspaceHref(workspaceSlug, item.link) : undefined;
                const body = (
                  <div
                    className={cn("notif-item", !item.read && "notif-item--unread")}
                    style={{ display: "flex", gap: 10, padding: "10px 10px", borderRadius: "var(--radius-control)" }}
                  >
                    <span
                      aria-hidden
                      className="notif-dot"
                      style={{ background: item.read ? "transparent" : "var(--accent)" }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: item.read ? 500 : 650, color: "var(--fg)" }}>{item.title}</div>
                      {item.body ? (
                        <div className="muted" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>{item.body}</div>
                      ) : null}
                      <div style={{ fontSize: 11.5, color: "var(--faint, var(--muted))", marginTop: 3 }}>{relativeTime(item.createdAt)}</div>
                    </div>
                  </div>
                );
                return href ? (
                  <Link key={item.id} href={href} role="menuitem" onClick={() => setOpen(false)} style={{ display: "block", textDecoration: "none" }}>
                    {body}
                  </Link>
                ) : (
                  <div key={item.id}>{body}</div>
                );
              })
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: 6 }}>
            <Link
              href={scopedWorkspaceHref(workspaceSlug, "/notifications")}
              role="menuitem"
              className="menu-item"
              onClick={() => setOpen(false)}
              style={{ justifyContent: "center", fontWeight: 600 }}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
