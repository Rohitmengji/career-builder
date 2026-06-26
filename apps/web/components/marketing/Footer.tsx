/*
 * Footer.tsx — site-wide footer for the public marketing/landing page (apps/web).
 *
 * WHAT: Renders the HireBase brand blurb, three columns of navigation links
 * (Product / Resources / Company), a copyright line, and social icon buttons.
 * Pure presentation — no tenant data, no DB, no client state; safe to render on
 * the server.
 *
 * WHY: Standard marketing-site footer. Link targets and social icons are kept as
 * static config (LINKS / SOCIAL) so copy changes don't require touching JSX.
 *
 * HOW: LINKS drives the column markup via Object.entries; SOCIAL holds raw SVG
 * path strings rendered into identical icon buttons. Links flagged `soon: true`
 * are rendered as a non-clickable label + "Soon" badge instead of an anchor.
 * In-page links use `#anchor` hrefs that scroll to landing-page sections.
 */
import React from "react";
import Link from "next/link";
import { Container, Badge } from "@/components/ui";

const LINKS = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Demo", href: "#demo" },
    { label: "Comparison", href: "#comparison" },
  ],
  Resources: [
    { label: "Documentation", href: "#", soon: true },
    { label: "Changelog", href: "#", soon: true },
    { label: "Blog", href: "#", soon: true },
    { label: "Status", href: "#", soon: true },
  ],
  Company: [
    { label: "About", href: "#", soon: true },
    { label: "Careers", href: "/jobs" },
    { label: "Contact", href: "mailto:hello@hirebase.dev" },
    { label: "Privacy", href: "#", soon: true },
  ],
};

const SOCIAL = [
  {
    label: "Twitter / X",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    label: "GitHub",
    path: "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z",
  },
  {
    label: "LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50/50">
      <Container className="py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/landing" className="inline-flex items-center gap-2 mb-4 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center" aria-hidden="true">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </span>
              <span className="text-lg font-bold text-gray-900">HireBase</span>
            </Link>
            <p className="text-sm text-gray-600 leading-relaxed max-w-[34ch]">
              AI-powered career site + hiring platform. Build, launch, and hire — all in one place.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <h2 className="text-sm font-semibold text-gray-900 mb-4">{title}</h2>
              <ul className="space-y-1">
                {links.map((link) => (
                  <li key={link.label}>
                    {"soon" in link && link.soon ? (
                      <span className="inline-flex items-center gap-2 py-2 text-sm text-gray-500 cursor-default">
                        {link.label}
                        <Badge tone="neutral">Soon</Badge>
                      </span>
                    ) : (
                      <a
                        href={link.href}
                        className="inline-flex items-center py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} HireBase. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href="#"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label={s.label}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
