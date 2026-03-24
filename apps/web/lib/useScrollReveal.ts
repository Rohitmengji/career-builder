/**
 * useScrollReveal — IntersectionObserver-based scroll reveal.
 *
 * Adds the `cb-reveal` class to elements, then toggles `cb-visible`
 * when they enter the viewport. CSS in globals.css handles the actual
 * animation (opacity + translateY).
 *
 * Respects prefers-reduced-motion — skips observer entirely and
 * marks all elements as visible immediately.
 *
 * Usage:
 *   const containerRef = useScrollReveal<HTMLElement>();
 *   <main ref={containerRef}> … sections … </main>
 *
 * Each direct child of the container gets the reveal treatment.
 */

"use client";

import { useEffect, useRef, useCallback } from "react";

const REVEAL_CLASS = "cb-reveal";
const VISIBLE_CLASS = "cb-visible";

/** Check reduced motion preference once. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;

    // If reduced motion, mark visible immediately — no animations
    if (prefersReducedMotion()) {
      children.forEach((child) => {
        child.classList.add(REVEAL_CLASS, VISIBLE_CLASS);
      });
      return;
    }

    // Add reveal class to all direct children
    children.forEach((child) => {
      child.classList.add(REVEAL_CLASS);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(VISIBLE_CLASS);
            observer.unobserve(entry.target); // once only
          }
        });
      },
      {
        rootMargin: "0px 0px -60px 0px", // trigger slightly before fully in view
        threshold: 0.08,
      }
    );

    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, []);

  return containerRef;
}

/**
 * useNavbarShrink — adds `cb-scrolled` class to a nav element on scroll.
 */
export function useNavbarShrink<T extends HTMLElement = HTMLElement>() {
  const navRef = useRef<T>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const onScroll = () => {
      if (window.scrollY > 10) {
        el.classList.add("cb-scrolled");
      } else {
        el.classList.remove("cb-scrolled");
      }
    };

    // Use passive listener for performance
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // initial check

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return navRef;
}
