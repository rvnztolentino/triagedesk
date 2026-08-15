"use client";

import Link from "next/link";
import { ArrowRight, Mail, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/brand-icon";
import { ThemeToggle } from "@/components/theme-controls";
import { TryDemoButton } from "@/components/try-demo-button";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "rvnztolentino@gmail.com";
const REPO_URL = "https://github.com/rvnztolentino/triagedesk";

const navItems = [
  { label: "How it Works", href: "#workflow" },
  { label: "Highlights", href: "#highlights" },
];

// Fixed-header height to offset scroll targets so section headings aren't hidden.
const HEADER_OFFSET = 80;

// lucide-react dropped its brand icons in v1, so the GitHub mark is inlined here.
function GithubIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.96 3.22 9.16 7.69 10.65.56.1.77-.24.77-.54 0-.27-.01-1.15-.02-2.09-3.13.68-3.79-1.34-3.79-1.34-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.42.11-2.97 0 0 .94-.3 3.09 1.16a10.7 10.7 0 0 1 5.62 0c2.14-1.46 3.08-1.16 3.08-1.16.61 1.55.23 2.69.11 2.97.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.29-5.15 5.56.4.35.76 1.04.76 2.1 0 1.52-.01 2.74-.01 3.11 0 .3.2.65.78.54a11.26 11.26 0 0 0 7.68-10.65C23.25 5.48 18.27.5 12 .5z" />
    </svg>
  );
}

// Resolved on the server from DEMO_SESSION_SECRET and the DEMO_ENABLED kill switch.
// Only the boolean crosses to the client, never the secret. With the demo off the
// header simply drops the button rather than advertising one that can only fail;
// the closing CTA on the landing page stays the way to /login.
export function HomeHeader({ demoEnabled }: { demoEnabled: boolean }) {
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
        Reach out and we&apos;ll get back to you as soon as we can.
      </p>
      <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn--primary btn--sm btn--block mt-4">
        <Mail className="h-4 w-4" />
        Send an email
      </a>
      <p className="mt-2.5 text-center text-xs text-muted">{CONTACT_EMAIL}</p>
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
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            aria-label="TriageDesk on GitHub"
            title="TriageDesk on GitHub"
          >
            <GithubIcon className="h-[18px] w-[18px]" />
          </a>
          <ThemeToggle />
          {/* The demo takes the slot `Sign in` used to hold. Everyone reading this
              page is logged out, and "Sign in" is a dead end to a visitor with no
              account. Returning users still have the link in the closing CTA. */}
          {demoEnabled ? <TryDemoButton buttonClassName="btn--neutral btn--sm" /> : null}
          <Link href="/signup?next=/onboarding" className="btn btn--primary btn--sm">
            Start now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            aria-label="TriageDesk on GitHub"
          >
            <GithubIcon className="h-[18px] w-[18px]" />
          </a>
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

          {demoEnabled ? <TryDemoButton className="mt-2" buttonClassName="btn--primary btn--block" /> : null}

          <div className="mt-3 rounded-[var(--radius-card)] border border-border bg-surface">
            {contactPanel}
          </div>
        </div>
      </div>
    </nav>
  );
}
