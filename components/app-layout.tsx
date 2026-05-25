"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  PlusCircle, 
  Inbox, 
  Ticket,
  Users,
  Settings
} from "lucide-react";
import { signOutAction } from "@/app/actions";
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
  const isAuthPage = pathname === "/login" || pathname.startsWith("/signup") || pathname.startsWith("/auth");
  const navItems = currentUser?.role === "admin" ? adminNavItems : requesterNavItems;

  if (isAuthPage) {
    return (
      <div className="bg-[#0a0a0a] text-neutral-200 min-h-screen w-full">
        {children}
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] text-neutral-200 h-dvh w-full flex overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#111111] border-r border-neutral-800 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-black font-bold text-lg">T</div>
            <span className="text-xl font-semibold tracking-tight text-white">TriageDesk</span>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          {currentUser ? navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
                  active 
                    ? "bg-neutral-800 text-white" 
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                )}
              >
                <item.icon size={20} className={active ? "opacity-100" : "opacity-70"} />
                {item.label}
              </Link>
            );
          }) : null}
        </nav>

        <div className="p-6 border-t border-neutral-800 mt-auto">
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-neutral-600 font-bold">Operations Workspace</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 shrink-0 border-b border-neutral-800 flex items-center justify-between px-8 bg-[#0a0a0a]/80 backdrop-blur-md">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            {currentUser ? (
            <div className="flex items-center gap-3 p-1 rounded-lg border border-transparent">
              <div className="w-9 h-9 bg-neutral-800 rounded-full border border-neutral-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                {initials(currentUser)}
              </div>
              <div className="flex flex-col pr-2">
                <span className="text-sm font-medium text-white leading-tight">{currentUser.displayName}</span>
                <span className="text-xs text-neutral-500 capitalize">{currentUser.role}</span>
              </div>
            </div>
            ) : (
              <Link href="/login" className="text-sm font-medium text-neutral-400 hover:text-white">Sign in</Link>
            )}
            {currentUser ? (
              <form action={signOutAction}>
                <button className="h-9 px-3 border border-neutral-800 rounded-lg text-xs font-bold text-neutral-400 hover:text-white hover:bg-[#111111] transition-colors">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 min-h-0 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
