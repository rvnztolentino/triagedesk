"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Inbox,
  LayoutDashboard,
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
import type { AppUser } from "@/lib/schema";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/submit", icon: PlusCircle, label: "New Request" },
  { href: "/review", icon: Inbox, label: "Review Queue" },
  { href: "/tickets", icon: Ticket, label: "All Tickets" },
  { href: "/users", icon: Users, label: "Users" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const requesterNavItems = [
  { href: "/submit", icon: PlusCircle, label: "New Request" },
  { href: "/tickets", icon: Ticket, label: "My Tickets" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

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

export function AppLayout({ children, currentUser }: { children: React.ReactNode; currentUser: AppUser | null }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const isAuthPage = pathname === "/login" || pathname.startsWith("/signup") || pathname.startsWith("/auth");
  const navItems = currentUser?.role === "admin" ? adminNavItems : requesterNavItems;

  React.useEffect(() => {
    React.startTransition(() => {
      setSidebarOpen(false);
      setProfileOpen(false);
    });
  }, [pathname]);

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
          "fixed inset-y-0 left-0 z-50 w-72 shrink-0 bg-[#111111] border-r border-neutral-800 flex flex-col overflow-hidden transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0",
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
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
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
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-neutral-600 font-bold">Operations Workspace</div>
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
                    <span className="text-xs text-neutral-500 capitalize">{currentUser.role}</span>
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

        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
