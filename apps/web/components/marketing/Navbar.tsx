"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGIN_URL } from "@/lib/marketing-config";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Compare", href: "#comparison" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // ── Scroll detection ────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Close on route change ───────────────────────────────────────
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // ── Body scroll lock ────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── ESC key closes drawer ───────────────────────────────────────
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

  // ── Focus trap inside drawer ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    // Focus first focusable element
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

  return (
    <>
      {/* ── Fixed header bar ──────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-xl border-b border-gray-200/60 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/landing" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">HireBase</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-500 hover:text-gray-900 transition-colors py-1"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={LOGIN_URL}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 min-h-11 flex items-center"
            >
              Sign in
            </a>
            <a
              href={LOGIN_URL}
              className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all shadow-sm min-h-11"
            >
              Start Free
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          {/* Mobile: Sign in + hamburger */}
          <div className="flex md:hidden items-center gap-1">
            <a
              href={LOGIN_URL}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 min-h-11 flex items-center transition-colors"
            >
              Sign in
            </a>
            <button
              ref={hamburgerRef}
              onClick={toggle}
              className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              aria-controls="mobile-drawer"
            >
              {/* Animated hamburger → X */}
              <span className="relative w-5 h-5 flex items-center justify-center">
                <span
                  className={`absolute block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${
                    isOpen ? "rotate-45 translate-y-0" : "-translate-y-1.5"
                  }`}
                />
                <span
                  className={`absolute block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${
                    isOpen ? "opacity-0 scale-x-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${
                    isOpen ? "-rotate-45 translate-y-0" : "translate-y-1.5"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile: Backdrop overlay — z-40, BELOW drawer (z-50) ─── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
        onClick={close}
      />

      {/* ── Mobile: Slide-in drawer — z-50, ABOVE overlay ────────── */}
      <div
        id="mobile-drawer"
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
          <Link href="/landing" className="flex items-center gap-2" onClick={close}>
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-base font-bold text-gray-900 tracking-tight">HireBase</span>
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
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={close}
                  className="flex items-center w-full text-gray-700 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100
                    font-medium text-base px-4 py-3.5 rounded-xl transition-colors min-h-11"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <hr className="my-6 border-gray-100" />

          {/* CTA buttons */}
          <div className="space-y-3 px-1">
            <a
              href={LOGIN_URL}
              className="flex items-center justify-center w-full min-h-12 px-4 py-3
                border border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100
                text-gray-700 font-semibold text-sm rounded-xl transition-all"
            >
              Sign in
            </a>
            <a
              href={LOGIN_URL}
              className="flex items-center justify-center gap-2 w-full min-h-12 px-4 py-3
                bg-gray-900 hover:bg-gray-800 active:bg-black
                text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
            >
              Start Free — It&apos;s Free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </nav>

        {/* Drawer footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400 text-center">
            No credit card required · Free forever
          </p>
        </div>
      </div>
    </>
  );
}
