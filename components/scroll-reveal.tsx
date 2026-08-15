"use client";

import { useEffect } from "react";

/**
 * Drives the `[data-reveal]` fade-up in globals.css.
 *
 * One observer for the whole page rather than a wrapper component per element:
 * the markup stays server-rendered and only opts in with a `data-reveal`
 * attribute, so nothing extra ships or re-renders as the page scrolls.
 */
export function ScrollReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (items.length === 0) return;

    // Reduced motion keeps the content, drops the movement. The CSS already
    // neutralizes the transition; clearing the attribute is just tidiness.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const el of items) el.removeAttribute("data-reveal");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);

          const el = entry.target as HTMLElement;
          el.dataset.reveal = "in";
          // Drop the attribute once the fade lands, so the reveal's easing and
          // stagger delay can't bleed into the element's own hover transitions.
          el.addEventListener("transitionend", () => el.removeAttribute("data-reveal"), { once: true });
        }
      },
      // Start a little before the element's top edge clears the fold so the
      // motion reads as part of the scroll rather than trailing behind it.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    for (const el of items) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return null;
}
