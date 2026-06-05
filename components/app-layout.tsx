"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
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
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
import { PageLoadingSpinner } from "@/components/page-loading-spinner";
import { ThemeToggle } from "@/components/theme-controls";
import type { AppUser, UserRole } from "@/lib/schema";
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
const previewNavItems = ownerNavItems.filter((item) => item.href !== "/users");

const requesterNavItems = [
  { href: "/submit", icon: PlusCircle, label: "New Request" },
  { href: "/tickets", icon: Ticket, label: "My Tickets" },
];

const workspaceNavItem = { href: "/onboarding", icon: Building2, label: "Workspace" };

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

function isNewRequestPath(path: string) {
  return path === "/submit" || path === "/requests/new" || /^\/w\/[^/]+\/requests\/new$/.test(path);
}

function isAuthPath(path: string) {
  return path === "/login" || path.startsWith("/signup") || path.startsWith("/auth");
}

export function AppLayout({
  children,
  currentUser,
  activeWorkspace,
}: {
  children: React.ReactNode;
  currentUser: AppUser | null;
  activeWorkspace: { name: string; slug: string; role: UserRole; isPreview: boolean } | null;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);
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

  if (isAuthPage) {
    return (
      <div className="bg-[#0a0a0a] text-neutral-200 min-h-screen w-full">
        {children}
      </div>
    );
  }

  if (!currentUser && pathname === "/") {
    return (
      <div className="bg-[#0a0a0a] text-neutral-200 min-h-screen w-full">
        {children}
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] text-neutral-200 h-dvh w-full flex overflow-hidden font-sans">
      {/* Mobile overlay */}
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[120] w-72 shrink-0 overscroll-contain flex flex-col overflow-hidden transition-transform duration-300 ease-out md:static md:z-auto md:w-[17rem] md:translate-x-0",
          "bg-[#0a0a0a] border-r border-neutral-800/60",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand area */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <BrandIcon size={28} className="rounded-md" />
              <span className="text-base font-semibold tracking-tight text-white lg:text-lg">TriageDesk</span>
            </Link>
            <button
              type="button"
              aria-label="Close sidebar"
              className="md:hidden h-9 w-9 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors inline-flex items-center justify-center"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Workspace indicator — compact pill */}
        {currentUser ? (
          <div className="px-4 pb-3">
            <Link
              href="/onboarding"
              className="flex items-center gap-2.5 rounded-full border border-neutral-800/60 bg-[#111111] px-3 py-2.5 transition-all duration-200 hover:border-neutral-700 hover:bg-neutral-800/50 group"
            >
              <div
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  activeWorkspace ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-800 text-neutral-500"
                )}
              >
                <Building2 size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 leading-none">
                  {activeWorkspace?.isPreview ? "Preview" : "Workspace"}
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-neutral-200 leading-tight group-hover:text-white transition-colors">
                  {activeWorkspace?.name ?? "Choose workspace"}
                </div>
              </div>
              <ChevronDown size={14} className="text-neutral-600 shrink-0" />
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
                      onClick={(event) => handleSidebarNavigate(event, href)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
                      )}
                    >
                      <item.icon
                        size={18}
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          active ? "text-emerald-400" : "text-neutral-500 group-hover:text-neutral-300"
                        )}
                      />
                      {item.label}
                      {active ? (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      ) : null}
                    </Link>
                  );
                })
            : null}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto px-4 pb-5 pt-3 border-t border-neutral-800/40">
          {activeWorkspace?.isPreview ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-3">
              <LockKeyhole size={12} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-medium text-amber-300">Preview — read-only</span>
            </div>
          ) : null}
          <div className="px-3 py-2 text-center text-xs uppercase text-neutral-600 font-semibold tracking-wider">
            Operational helpdesk
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <header className="relative z-[90] shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 h-16">
          {/* Left: mobile hamburger + spacer */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              className="md:hidden h-9 w-9 rounded-full bg-transparent text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors inline-flex items-center justify-center"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>

            {/* Mobile brand */}
            <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="TriageDesk home">
              <BrandIcon size={24} className="rounded-md" />
              <span className="text-sm font-semibold tracking-tight text-white">TriageDesk</span>
            </Link>
          </div>

          {/* Right side: actions */}
          <div className="flex items-center gap-2">
            {/* Workspace switcher — header (visible on tablet+) */}
            {currentUser ? (
              <Link
                href="/onboarding"
                aria-label={activeWorkspace ? `Current ${activeWorkspace.isPreview ? "preview " : ""}workspace: ${activeWorkspace.name}` : "Choose a workspace"}
                className="hidden sm:inline-flex items-center gap-2 h-9 rounded-full border border-neutral-800/60 bg-[#111111] px-3 text-left hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-200"
              >
                <Building2 size={14} className={activeWorkspace ? "text-emerald-400 shrink-0" : "text-neutral-500 shrink-0"} />
                <span className="max-w-[10rem] truncate text-xs font-medium text-neutral-300">
                  {activeWorkspace?.name ?? "Choose workspace"}
                </span>
              </Link>
            ) : null}

            <ThemeToggle />

            {currentUser ? (
              <div className="relative">
                <button
                  id="app-profile-btn"
                  type="button"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  onClick={() => setProfileOpen((open) => !open)}
                  className={cn(
                    "flex items-center gap-2 py-1 pl-1 pr-2 rounded-full border transition-all duration-200",
                    profileOpen
                      ? "border-neutral-700 bg-[#111111]"
                      : "border-transparent hover:border-neutral-800 hover:bg-[#111111]"
                  )}
                >
                  <div className="w-8 h-8 bg-emerald-500/15 rounded-full border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                    {initials(currentUser)}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-neutral-300 max-w-[8rem] truncate">
                    {currentUser.displayName}
                  </span>
                  <ChevronDown size={14} className={cn("text-neutral-500 transition-transform duration-200", profileOpen ? "rotate-180" : "")} />
                </button>

                {profileOpen ? (
                  <div
                    id="app-profile-menu"
                    role="menu"
                    className="absolute right-0 top-12 z-[100] w-60 rounded-2xl border border-neutral-800 bg-[#111111] p-1.5 shadow-2xl shadow-black/20 app-dropdown-enter"
                  >
                    <div className="px-3 py-2.5 border-b border-neutral-800/60 mb-1">
                      <div className="text-sm font-semibold text-white truncate">{currentUser.displayName}</div>
                      <div className="text-xs text-neutral-500 truncate mt-0.5">{currentUser.email}</div>
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                        {activeWorkspace?.isPreview ? "preview" : activeWorkspace?.role ?? currentUser.role}
                      </div>
                    </div>
                    <form action={signOutAction}>
                      <button className="w-full h-9 px-3 rounded-full text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors flex items-center gap-2">
                        <LogOut size={15} /> Sign out
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white">Sign in</Link>
            )}
          </div>
        </header>

        {/* Preview banner */}
        {activeWorkspace?.isPreview ? (
          <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 md:px-6">
            <div className="flex items-start gap-2 text-sm">
              <LockKeyhole size={15} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-amber-100">
                <span className="font-bold text-amber-300">Preview locked.</span>{" "}
                Demo Clinic is read-only. Explore the sample workflow, then create your own workspace to use actions.
              </p>
            </div>
          </div>
        ) : null}

        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-8" aria-busy={pendingPath ? true : undefined}>
          {pendingPath ? (isNewRequestPath(pendingPath) || isAuthPath(pendingPath) ? <PageLoadingSpinner /> : <PageLoadingSkeleton />) : children}
        </main>
      </div>
    </div>
  );
}
