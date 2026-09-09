"use client";

import Link from "next/link";
import { ArrowRight, Mail, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/brand-icon";
import { ThemeToggle } from "@/components/theme-controls";
import { cn } from "@/lib/utils";

// Public support address, intentionally unset in the repo so a personal inbox is
// not committed to source and rendered on the marketing page, where it gets
// scraped. Deployments that want to receive mail set it; when it is blank the
// contact panel says so rather than offering a dead button. The value is inlined
// into the client bundle at build time, so only ever set an address meant to be
// public.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";

const navItems = [
  { label: "How it Works", href: "#workflow" },
  { label: "Highlights", href: "#highlights" },
];

// Fixed-header height to offset scroll targets so section headings aren't hidden.
const HEADER_OFFSET = 80;

// The header keeps a plain Sign in link next to Start now. It is text, not a
// button, so the primary call to action stays the only button in the slot. The
// demo lives in the hero and the closing CTA on the landing page instead.
export function HomeHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const lastScrollY = useRef(0);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
        setIsMobileMenuOpen(false);
        setIsContactOpen(false);
      } else {
        setIsVisible(true);
      }

      setIsScrolled(currentScrollY > 50);
      lastScrollY.current = currentScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the contact popover when clicking outside of it or pressing Escape.
  useEffect(() => {
    if (!isContactOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(event.target as Node)) {
        setIsContactOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsContactOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isContactOpen]);

  // Smooth-scroll to in-page anchors. Driving the scroll ourselves (instead of
  // relying on the URL hash) means repeat clicks on the same item always work,
  // and lets us offset for the fixed header.
  function handleAnchorClick(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    setIsMobileMenuOpen(false);
  }

  const contactPanel = (
    <div className="p-4">
      <p className="text-sm font-semibold text-fg">Need help?</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {CONTACT_EMAIL
          ? "Reach out and we'll get back to you as soon as we can."
          : "No contact address is configured for this deployment."}
      </p>
      {CONTACT_EMAIL ? (
        <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn--primary btn--sm btn--block mt-4">
          <Mail className="h-4 w-4" />
          Send an email
        </a>
      ) : null}
    </div>
  );

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
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide text-muted">
            Beta
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(event) => handleAnchorClick(event, item.href)}
              className="rounded-[var(--radius-control)] px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
            >
              {item.label}
            </a>
          ))}

          <div ref={contactRef} className="relative">
            <button
              type="button"
              onClick={() => setIsContactOpen((open) => !open)}
              className="rounded-[var(--radius-control)] px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
              aria-expanded={isContactOpen}
              aria-haspopup="dialog"
            >
              Contact
            </button>
            <div
              role="dialog"
              aria-label="Contact"
              className={cn(
                "absolute right-0 top-full mt-2 w-64 origin-top-right overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface transition-all duration-200 ease-out",
                isContactOpen ? "visible scale-100 opacity-100" : "pointer-events-none invisible scale-95 opacity-0"
              )}
              style={{ boxShadow: "var(--shadow-lg)" }}
            >
              {contactPanel}
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-[var(--radius-control)] px-3 py-2 text-sm text-muted no-underline transition-colors hover:text-fg hover:no-underline"
          >
            Sign in
          </Link>
          <Link href="/signup?next=/onboarding" className="btn btn--primary btn--sm">
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
          isMobileMenuOpen ? "max-h-[520px] opacity-100" : "pointer-events-none max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-1 px-5 py-4 sm:px-6">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(event) => handleAnchorClick(event, item.href)}
              className="rounded-[var(--radius-control)] px-3 py-3 text-base text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              {item.label}
            </a>
          ))}

          <Link
            href="/login"
            className="rounded-[var(--radius-control)] px-3 py-3 text-base text-muted no-underline transition-colors hover:bg-surface-hover hover:text-fg hover:no-underline"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Sign in
          </Link>

          <div className="mt-3 rounded-[var(--radius-card)] border border-border bg-surface">
            {contactPanel}
          </div>
        </div>
      </div>
    </nav>
  );
}
