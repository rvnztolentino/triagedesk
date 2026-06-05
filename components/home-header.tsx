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
        "fixed top-4 left-1/2 z-50 w-[92%] -translate-x-1/2 rounded-full border transition-all duration-500 ease-out",
        isScrolled
          ? "max-w-3xl border-neutral-800 bg-[#111111] shadow-2xl shadow-black/15 backdrop-blur-lg lg:max-w-4xl"
          : "max-w-3xl border-neutral-800 bg-[#111111] shadow-xl shadow-black/10 backdrop-blur-md lg:max-w-5xl",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-[150%] opacity-0"
      )}
      aria-label="Home navigation"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6 sm:py-3.5 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80" aria-label="TriageDesk home">
          <BrandIcon size={28} className="rounded-md" />
          <span className="text-base font-semibold tracking-tight text-white lg:text-lg">TriageDesk</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="rounded-full px-4 py-2 text-sm text-neutral-400 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link
            href="/signup?next=/onboarding"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-bold text-black transition-colors hover:bg-emerald-600"
          >
            Start now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-white transition-colors hover:bg-neutral-800"
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
          "absolute top-full left-0 right-0 mt-3 overflow-hidden rounded-2xl border border-neutral-800 bg-[#111111] shadow-2xl shadow-black/15 backdrop-blur-lg transition-all duration-300 ease-out lg:hidden",
          isMobileMenuOpen ? "max-h-[420px] translate-y-0 p-4 opacity-100" : "pointer-events-none max-h-0 -translate-y-2 p-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-1.5">
          {navItems.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "rounded-lg px-4 py-3 text-base text-neutral-400 transition-all duration-200 hover:bg-neutral-800 hover:text-white",
                isMobileMenuOpen ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
              )}
              style={{ transitionDelay: isMobileMenuOpen ? `${index * 50}ms` : "0ms" }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-lg px-4 py-3 text-base text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/signup?next=/onboarding"
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-bold text-black transition-colors hover:bg-emerald-600"
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
