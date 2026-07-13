"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { signOutAction } from "@/app/actions";
import { BrandIcon } from "@/components/brand-icon";
import { ThemeToggle } from "@/components/theme-controls";
import { NotificationBell } from "@/components/notification-bell";
import type { AppUser, NotificationView, UserRole } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

const ownerNavItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/submit", icon: PlusCircle, label: "New Request" },
  { href: "/review", icon: Inbox, label: "Review Queue" },
  { href: "/tickets", icon: Ticket, label: "All Tickets" },
  { href: "/users", icon: Users, label: "Users" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const adminNavItems = ownerNavItems;
// The demo preview exposes the full owner surface (including a sample Users
// roster); all actions on those pages are locked server-side.
const previewNavItems = ownerNavItems;

const requesterNavItems = [
  { href: "/submit", icon: PlusCircle, label: "New Request" },
  { href: "/tickets", icon: Ticket, label: "My Tickets" },
];

const workspaceNavItem = { href: "/onboarding", icon: Building2, label: "Workspace" };

function roleHue(role: string): "active" | "info" | "neutral" {
  if (role === "owner") return "active";
  if (role === "admin") return "info";
  return "neutral";
}

function initials(user: AppUser | null) {
  if (!user) return "TD";
  const label = user.displayName || user.email;
  return label
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isModifiedClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function isAuthPath(path: string) {
  return path === "/login" || path.startsWith("/signup") || path.startsWith("/auth");
}

function isPublicPath(path: string) {
  return path === "/" || isAuthPath(path);
}

const SIDEBAR_COLLAPSED_KEY = "triagedesk-sidebar-collapsed";

function RouteProgress({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[200] h-0.5 overflow-hidden" aria-hidden>
      <div className="app-route-progress h-full w-2/5 rounded-full bg-accent" />
    </div>
  );
}

export function AppLayout({
  children,
  currentUser,
  activeWorkspace,
  notifications = [],
  unreadNotifications = 0,
}: {
  children: React.ReactNode;
  currentUser: AppUser | null;
  activeWorkspace: { name: string; slug: string; role: UserRole; isPreview: boolean } | null;
  notifications?: NotificationView[];
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const mainRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
      React.startTransition(() => setCollapsed(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const isAuthPage = isAuthPath(pathname);
  const operationalNavItems = activeWorkspace?.isPreview
    ? previewNavItems
    : activeWorkspace?.role === "owner"
      ? ownerNavItems
      : activeWorkspace?.role === "admin"
        ? adminNavItems
        : requesterNavItems;
  const navItems = activeWorkspace ? [...operationalNavItems, workspaceNavItem] : [workspaceNavItem];

  React.useEffect(() => {
    React.startTransition(() => {
      setSidebarOpen(false);
      setProfileOpen(false);
      setPendingPath(null);
    });
  }, [pathname]);

  React.useEffect(() => {
    if (!pendingPath) return;
    const timeout = window.setTimeout(() => setPendingPath(null), 10000);
    return () => window.clearTimeout(timeout);
  }, [pendingPath]);

  React.useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const handleScroll = () => {
      setIsScrolled(mainEl.scrollTop > 0);
    };

    mainEl.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      mainEl.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  React.useEffect(() => {
    if (!profileOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const profileMenu = document.getElementById("app-profile-menu");
      const profileBtn = document.getElementById("app-profile-btn");
      if (profileMenu?.contains(target) || profileBtn?.contains(target)) return;
      setProfileOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  function handleSidebarNavigate(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    setSidebarOpen(false);
    if (event.defaultPrevented || isModifiedClick(event) || event.currentTarget.target === "_blank") return;

    const nextPath = new URL(href, window.location.origin).pathname;
    if (nextPath !== pathname) {
      setPendingPath(nextPath);
    }
  }

  function handlePublicNavigate(event: React.MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const nextUrl = new URL(href, window.location.origin);
    if (nextUrl.origin !== window.location.origin) return;

    if (nextUrl.pathname !== pathname && isPublicPath(nextUrl.pathname)) {
      setPendingPath(nextUrl.pathname);
    }
  }

  if (isAuthPage) {
    return (
      <div className="bg-bg text-fg min-h-screen w-full" onClickCapture={handlePublicNavigate}>
        <RouteProgress active={!!pendingPath} />
        <div key={pathname} className="app-page-in">{children}</div>
      </div>
    );
  }

  if (!currentUser && pathname === "/") {
    return (
      <div className="bg-bg text-fg min-h-screen w-full" onClickCapture={handlePublicNavigate}>
        <RouteProgress active={!!pendingPath} />
        <div key={pathname} className="app-page-in">{children}</div>
      </div>
    );
  }

  return (
    <div className="bg-bg text-fg h-dvh w-full flex overflow-hidden font-sans">
      <RouteProgress active={!!pendingPath} />
      {/* Mobile overlay — kept mounted so it can fade in/out with the sidebar */}
      <button
        type="button"
        aria-label="Close sidebar"
        tabIndex={sidebarOpen ? 0 : -1}
        aria-hidden={sidebarOpen ? undefined : true}
        className={cn(
          "fixed inset-0 z-[110] bg-black/40 md:hidden transition-opacity duration-300 ease-out",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[120] w-72 shrink-0 overscroll-contain flex flex-col overflow-hidden transition-[transform,width] duration-300 ease-out md:static md:z-auto md:w-[17rem] md:translate-x-0",
          "bg-bg border-r border-border",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "md:w-[4.25rem]"
        )}
      >
        {/* Brand area */}
        <div className={cn("px-5 pt-5 pb-4", collapsed && "md:px-0")}>
          <div className={cn("flex items-center justify-between gap-3", collapsed && "md:justify-center")}>
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <BrandIcon size={26} className="rounded-md" />
              <span className={cn("whitespace-nowrap text-[15px] font-semibold tracking-tight text-fg", collapsed && "md:hidden")}>TriageDesk</span>
            </Link>
            <button
              type="button"
              aria-label="Close sidebar"
              className="md:hidden h-9 w-9 rounded-[var(--radius-control)] text-muted hover:text-fg hover:bg-surface-hover transition-colors inline-flex items-center justify-center"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Workspace indicator — compact pill */}
        {currentUser ? (
          <div className={cn("px-4 pb-3", collapsed && "md:px-2")}>
            <Link
              href="/onboarding"
              title={collapsed ? activeWorkspace?.name ?? "Choose workspace" : undefined}
              className={cn(
                "group flex items-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2.5 transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover",
                collapsed && "md:justify-center md:px-0"
              )}
            >
              <div
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                  activeWorkspace ? "bg-accent-soft text-accent" : "bg-surface-hover text-muted"
                )}
              >
                <Building2 size={14} />
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
                <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint leading-none">
                  {activeWorkspace?.isPreview ? "Preview" : "Workspace"}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-fg leading-tight transition-colors">
                  {activeWorkspace?.name ?? "Choose workspace"}
                </div>
              </div>
              <ChevronDown size={14} className={cn("text-faint shrink-0", collapsed && "md:hidden")} />
            </Link>
          </div>
        ) : null}

        {/* Nav links */}
        <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto overscroll-contain" aria-label="Main navigation">
          {currentUser
            ? navItems
                .filter((item) => item.href !== "/onboarding")
                .map((item) => {
                  const href = scopedWorkspaceHref(activeWorkspace?.slug, item.href);
                  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      prefetch={false}
                      title={collapsed ? item.label : undefined}
                      onClick={(event) => handleSidebarNavigate(event, href)}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-[var(--radius-control)] text-sm font-medium transition-colors duration-200",
                        active
                          ? "bg-accent-soft text-accent"
                          : "text-muted hover:text-fg hover:bg-surface-hover",
                        collapsed && "md:justify-center md:gap-0 md:px-0"
                      )}
                    >
                      <item.icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          active ? "text-accent" : "text-faint group-hover:text-fg"
                        )}
                      />
                      <span className={cn("whitespace-nowrap", collapsed && "md:hidden")}>{item.label}</span>
                      {active ? (
                        <span className={cn("ml-auto h-1.5 w-1.5 rounded-full bg-accent", collapsed && "md:hidden")} />
                      ) : null}
                    </Link>
                  );
                })
            : null}
        </nav>

        {/* Bottom section */}
        <div className={cn("mt-auto px-4 pb-5 pt-3 border-t border-border", collapsed && "md:px-2")}>
          {activeWorkspace?.isPreview ? (
            <div
              className={cn(
                "st-warn flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 mb-3",
                collapsed && "md:justify-center md:px-0"
              )}
              title={collapsed ? "Preview — read-only" : undefined}
            >
              <LockKeyhole size={12} className="shrink-0" />
              <span className={cn("whitespace-nowrap text-[11px] font-medium", collapsed && "md:hidden")}>Preview — read-only</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden md:flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-[12.5px] font-medium text-faint hover:text-fg hover:bg-surface-hover transition-colors",
              collapsed && "md:justify-center md:px-0"
            )}
          >
            {collapsed ? <ChevronsRight size={17} className="shrink-0" /> : <ChevronsLeft size={17} className="shrink-0" />}
            <span className={cn("whitespace-nowrap", collapsed && "md:hidden")}>Collapse</span>
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
        {/* Header */}
        <header
          className={cn(
            "absolute top-0 left-0 right-0 z-[90] shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 h-16 transition-colors duration-200",
            isScrolled
              ? "bg-bg/70 backdrop-blur-md border-b border-border"
              : "bg-transparent border-b border-transparent"
          )}
        >
          {/* Left: mobile hamburger + spacer */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              className="md:hidden h-9 w-9 rounded-[var(--radius-control)] bg-transparent text-muted hover:text-fg hover:bg-surface-hover transition-colors inline-flex items-center justify-center"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>

            {/* Mobile brand */}
            <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="TriageDesk home">
              <BrandIcon size={22} className="rounded-md" />
              <span className="text-sm font-semibold tracking-tight text-fg">TriageDesk</span>
            </Link>
          </div>

          {/* Right side: actions */}
          <div className="flex items-center gap-2">
            {/* Workspace switcher — header (visible on tablet+) */}
            {currentUser ? (
              <Link
                href="/onboarding"
                aria-label={activeWorkspace ? `Current ${activeWorkspace.isPreview ? "preview " : ""}workspace: ${activeWorkspace.name}` : "Choose a workspace"}
                className="hidden sm:inline-flex items-center gap-2 h-9 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-left hover:border-border-strong hover:bg-surface-hover transition-colors duration-200"
              >
                <Building2 size={14} className={activeWorkspace ? "text-accent shrink-0" : "text-muted shrink-0"} />
                <span className="max-w-[10rem] truncate text-xs font-medium text-muted">
                  {activeWorkspace?.name ?? "Choose workspace"}
                </span>
              </Link>
            ) : null}

            <ThemeToggle />

            {currentUser && activeWorkspace ? (
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadNotifications}
                workspaceSlug={activeWorkspace.slug}
              />
            ) : null}

            {currentUser ? (
              <div className="relative">
                <button
                  id="app-profile-btn"
                  type="button"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  onClick={() => setProfileOpen((open) => !open)}
                  className={cn(
                    "flex items-center gap-2 py-1 pl-1 pr-2 rounded-[var(--radius-control)] border transition-colors duration-200",
                    profileOpen
                      ? "border-border-strong bg-surface"
                      : "border-transparent hover:border-border hover:bg-surface"
                  )}
                >
                  <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                    {initials(currentUser)}
                  </span>
                  <span className="hidden sm:block text-sm font-medium text-muted max-w-[8rem] truncate">
                    {currentUser.displayName}
                  </span>
                  <ChevronDown size={14} className={cn("text-faint transition-transform duration-200", profileOpen ? "rotate-180" : "")} />
                </button>

                {profileOpen ? (
                  <div
                    id="app-profile-menu"
                    role="menu"
                    className="menu"
                    style={{ right: 0, top: "calc(100% + 10px)", width: 264 }}
                  >
                    <div className="menu-head">
                      <div className="cluster" style={{ gap: 11 }}>
                        <span className="avatar lg">{initials(currentUser)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="truncate" style={{ fontWeight: 650 }}>{currentUser.displayName}</div>
                          <div className="muted truncate" style={{ fontSize: 12.5 }}>{currentUser.email}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <span className="badge" data-hue={activeWorkspace?.isPreview ? "warn" : roleHue(activeWorkspace?.role ?? currentUser.role)}>
                          {activeWorkspace?.isPreview ? "Preview" : activeWorkspace?.role ?? currentUser.role}
                        </span>
                      </div>
                    </div>
                    <Link href="/onboarding" role="menuitem" className="menu-item" onClick={() => setProfileOpen(false)}>
                      <Building2 size={15} className="text-muted" /> Workspaces
                    </Link>
                    {activeWorkspace ? (
                      <Link
                        href={scopedWorkspaceHref(activeWorkspace.slug, "/settings")}
                        role="menuitem"
                        className="menu-item"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Settings size={15} className="text-muted" /> Workspace settings
                      </Link>
                    ) : null}
                    <div className="divider" style={{ margin: "6px 4px" }} />
                    <form action={signOutAction}>
                      <button type="submit" role="menuitem" className="menu-item danger">
                        <LogOut size={15} /> Sign out
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href="/login" className="rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-fg">Sign in</Link>
            )}
          </div>
        </header>

        {/* Main content */}
        <main
          ref={mainRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 pt-20 md:px-8 md:pb-8 md:pt-24"
          aria-busy={pendingPath ? true : undefined}
        >
          {activeWorkspace?.isPreview ? (
            <div className="st-warn mb-6 rounded-[var(--radius-card)] border p-4">
              <div className="flex items-start gap-2 text-sm">
                <LockKeyhole size={15} className="mt-0.5 shrink-0" />
                <p>
                  <span className="font-semibold">Preview locked.</span>{" "}
                  Demo Clinic is read-only. Explore the sample workflow, then create your own workspace to use actions.
                </p>
              </div>
            </div>
          ) : null}
          <div key={pathname} className="app-page-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
