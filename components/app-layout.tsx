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
  { href: "/settings", icon: Settings, label: "Settings" },
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
  const isAuthPage = pathname === "/login" || pathname.startsWith("/signup") || pathname.startsWith("/auth");
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

  return (
    <div className="bg-[#0a0a0a] text-neutral-200 h-dvh w-full flex overflow-hidden font-sans">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 shrink-0 overscroll-contain bg-[#111111] border-r border-neutral-800 flex flex-col overflow-hidden transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BrandIcon size={32} />
              <span className="text-xl font-semibold tracking-tight text-white">TriageDesk</span>
            </div>
            <button
              type="button"
              aria-label="Close sidebar"
              className="md:hidden h-9 w-9 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="flex h-full w-full items-center justify-center">
                <X size={18} />
              </span>
            </button>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          {currentUser
            ? navItems.map((item) => {
                const href = item.href === "/onboarding" ? item.href : scopedWorkspaceHref(activeWorkspace?.slug, item.href);
                const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={item.href}
                    href={href}
                    prefetch={false}
                    onClick={(event) => handleSidebarNavigate(event, href)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
                      active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                    )}
                  >
                    <item.icon size={20} className={active ? "opacity-100" : "opacity-70"} />
                    {item.label}
                  </Link>
                );
              })
            : null}
        </nav>

        <div className="p-6 border-t border-neutral-800 mt-auto">
          <div className="px-3 py-2 text-center text-xs uppercase tracking-wider text-neutral-600 font-bold">
            <div>{activeWorkspace?.name ?? "Choose Workspace"}</div>
            {activeWorkspace?.isPreview ? <div className="mt-1 text-[9px] text-amber-400">Preview locked</div> : null}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="h-16 md:h-20 shrink-0 border-b border-neutral-800 flex items-center justify-between px-4 md:px-8 bg-[#0a0a0a]/80 backdrop-blur-md">
          <button
            type="button"
            aria-label="Open sidebar"
            className="md:hidden h-10 w-10 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="flex h-full w-full items-center justify-center">
              <Menu size={20} />
            </span>
          </button>

          <div className="hidden md:block flex-1" />

          <div className="flex items-center gap-2 md:gap-3">
            {currentUser ? (
              <Link
                href="/onboarding"
                aria-label={activeWorkspace ? `Current ${activeWorkspace.isPreview ? "preview " : ""}workspace: ${activeWorkspace.name}` : "Choose a workspace"}
                className="h-10 max-w-52 rounded-lg border border-neutral-800 bg-[#111111] px-2.5 text-left hover:border-neutral-700 hover:bg-neutral-900 transition-colors inline-flex items-center gap-2"
              >
                <Building2 size={16} className={activeWorkspace ? "text-emerald-400 shrink-0" : "text-neutral-500 shrink-0"} />
                <span className="hidden sm:flex min-w-0 flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 leading-none">{activeWorkspace?.isPreview ? "Preview workspace" : "Workspace"}</span>
                  <span className="mt-1 truncate text-xs font-semibold text-neutral-200 leading-none">
                    {activeWorkspace?.name ?? "Choose workspace"}
                  </span>
                </span>
              </Link>
            ) : null}
            <ThemeToggle />
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center gap-2 md:gap-3 p-1 rounded-lg border border-transparent hover:border-neutral-800 hover:bg-[#111111] transition-colors"
                >
                  <div className="w-9 h-9 bg-neutral-800 rounded-full border border-neutral-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                    {initials(currentUser)}
                  </div>
                  <div className="hidden sm:flex flex-col pr-1 text-left">
                    <span className="text-sm font-medium text-white leading-tight max-w-36 truncate">{currentUser.displayName}</span>
                    <span className="text-xs text-neutral-500 capitalize">{activeWorkspace?.isPreview ? "preview locked" : activeWorkspace?.role ?? currentUser.role}</span>
                  </div>
                  <ChevronDown size={15} className={cn("text-neutral-500 transition-transform", profileOpen ? "rotate-180" : "")} />
                </button>

                {profileOpen ? (
                  <div role="menu" className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-neutral-800 bg-[#111111] p-2 shadow-2xl">
                    <div className="px-3 py-2 border-b border-neutral-800 mb-2">
                      <div className="text-sm font-semibold text-white truncate">{currentUser.displayName}</div>
                      <div className="text-xs text-neutral-500 truncate">{currentUser.email}</div>
                    </div>
                    <form action={signOutAction}>
                      <button className="w-full h-10 px-3 rounded-lg text-sm font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors flex items-center gap-2">
                        <LogOut size={16} /> Sign out
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href="/login" className="text-sm font-medium text-neutral-400 hover:text-white">Sign in</Link>
            )}
          </div>
        </header>

        {activeWorkspace?.isPreview ? (
          <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 md:px-8">
            <div className="flex items-start gap-2 text-sm">
              <LockKeyhole size={15} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-amber-100">
                <span className="font-bold text-amber-300">Preview locked.</span>{" "}
                Demo Clinic is read-only. Explore the sample workflow, then create your own workspace to use actions.
              </p>
            </div>
          </div>
        ) : null}

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-8" aria-busy={pendingPath ? true : undefined}>
          {pendingPath ? <PageLoadingSkeleton /> : children}
        </main>
      </div>
    </div>
  );
}
