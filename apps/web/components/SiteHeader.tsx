"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SiteHeaderProps {
  companyName: string;
  hasAbout: boolean;
  hasCulture: boolean;
  hasBenefits: boolean;
}

/**
 * Public career site header with a production-grade mobile drawer.
 * Shared across the root home page and any future server pages that
 * need a consistent nav. All behaviour (scroll, ESC, focus-trap,
 * body-scroll-lock) mirrors the marketing Navbar pattern.
 */
export default function SiteHeader({
  companyName,
  hasAbout,
  hasCulture,
  hasBenefits,
}: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !drawerRef.current) return;
      const items = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Dynamic nav links based on which pages are published
  const navLinks = [
    ...(hasAbout ? [{ label: "About", href: "/about" }] : []),
    ...(hasCulture ? [{ label: "Culture", href: "/culture" }] : []),
    ...(hasBenefits ? [{ label: "Benefits", href: "/benefits" }] : []),
    { label: "Jobs", href: "/jobs" },
  ];

  return (
    <>
      {/* ── Fixed header bar ─────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100"
            : "bg-white/80 backdrop-blur-lg border-b border-gray-100"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link
            href="/"
            className="text-base font-semibold text-gray-900 tracking-tight shrink-0 hover:text-blue-600 transition-colors"
          >
            {companyName}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/careers"
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-11 flex items-center"
            >
              Careers
            </Link>
          </nav>

          {/* Mobile: Careers CTA + hamburger */}
          <div className="flex md:hidden items-center gap-1">
            <Link
              href="/careers"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 min-h-11 flex items-center transition-colors"
            >
              Careers
            </Link>
            <button
              ref={hamburgerRef}
              onClick={toggle}
              className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              aria-controls="site-mobile-drawer"
            >
              {/* Animated hamburger → X */}
              <span className="relative w-5 h-5 flex items-center justify-center" aria-hidden="true">
                <span className={`absolute block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${isOpen ? "rotate-45 translate-y-0" : "-translate-y-1.5"}`} />
                <span className={`absolute block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${isOpen ? "opacity-0 scale-x-0" : "opacity-100"}`} />
                <span className={`absolute block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${isOpen ? "-rotate-45 translate-y-0" : "translate-y-1.5"}`} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Backdrop overlay — z-40 ───────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
        onClick={close}
      />

      {/* ── Slide-in drawer — z-50 ────────────────────────────────── */}
      <div
        id="site-mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 h-full w-[80%] max-w-sm z-50 bg-white shadow-2xl
          flex flex-col transition-transform duration-300 ease-out md:hidden
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
          <Link
            href="/"
            onClick={close}
            className="text-base font-semibold text-gray-900 tracking-tight hover:text-blue-600 transition-colors"
          >
            {companyName}
          </Link>
          <button
            onClick={close}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Mobile navigation">
          <ul className="space-y-1" role="list">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={close}
                  className="flex items-center w-full text-gray-700 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100
                    font-medium text-base px-4 py-3.5 rounded-xl transition-colors min-h-11"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <hr className="my-6 border-gray-100" />

          {/* CTA */}
          <div className="px-1">
            <Link
              href="/careers"
              onClick={close}
              className="flex items-center justify-center gap-2 w-full min-h-12 px-4 py-3
                bg-gray-900 hover:bg-gray-800 active:bg-black
                text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
            >
              View Open Positions
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
