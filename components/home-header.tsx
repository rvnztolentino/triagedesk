"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/brand-icon";
import { ThemeToggle } from "@/components/theme-controls";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Workflow", href: "#workflow" },
  { label: "Preview", href: "#preview" },
  { label: "Highlights", href: "#highlights" },
];

export function HomeHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
        setIsMobileMenuOpen(false);
      } else {
        setIsVisible(true);
      }

      setIsScrolled(currentScrollY > 50);
      lastScrollY.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ease-out",
        isScrolled ? "border-border bg-bg/70 backdrop-blur-lg" : "border-transparent bg-transparent",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
      aria-label="Home navigation"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TriageDesk home">
          <BrandIcon size={26} className="rounded-md" />
          <span className="text-[15px] font-semibold tracking-tight text-fg">TriageDesk</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="rounded-[var(--radius-control)] px-3 py-2 text-sm text-muted transition-colors hover:text-fg">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link href="/login" className="rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg">
            Sign in
          </Link>
          <Link
            href="/signup?next=/onboarding"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-4 text-sm font-medium text-accent-fg transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Start now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-transparent text-fg transition-colors hover:bg-surface-hover"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu className={cn("absolute h-5 w-5 transition-all duration-300", isMobileMenuOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100")} />
            <X className={cn("absolute h-5 w-5 transition-all duration-300", isMobileMenuOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0")} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border bg-bg transition-all duration-300 ease-out lg:hidden",
          isMobileMenuOpen ? "max-h-[420px] opacity-100" : "pointer-events-none max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-1 px-5 py-4 sm:px-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-[var(--radius-control)] px-3 py-3 text-base text-muted transition-colors hover:bg-surface-hover hover:text-fg"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-[var(--radius-control)] px-3 py-3 text-base text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/signup?next=/onboarding"
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-6 text-sm font-medium text-accent-fg transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Start now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
