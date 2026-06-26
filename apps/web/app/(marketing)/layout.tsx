/*
 * Layout for the (marketing) route group — the HireBase product site (landing, etc.).
 *
 * WHAT: A pass-through layout (renders children only, no chrome) whose sole job is
 * to export static SEO metadata for the marketing pages: title, description,
 * keywords, OpenGraph, Twitter card, and index/follow robots directives.
 *
 * WHY: Marketing pages are about the HireBase *product* and have fixed, brand-owned
 * copy/URLs — distinct from the per-tenant career site (see app/layout.tsx, which
 * derives metadata from tenant branding). Splitting them via this route group keeps
 * product SEO out of tenant pages.
 *
 * HOW: metadataBase is pinned to NEXT_PUBLIC_SITE_URL so relative OG/image URLs and
 * the share image (opengraph-image.tsx in this group) resolve to absolute URLs.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "HireBase — AI-Powered Career Site + Hiring Platform",
  description:
    "Build your career site in minutes with AI. Job listings, hiring workflows, visual editor — all in one platform. Trusted by modern teams.",
  keywords: [
    "career site builder",
    "AI hiring platform",
    "job listing software",
    "career page generator",
    "ATS alternative",
    "visual career site editor",
  ],
  openGraph: {
    title: "HireBase — Build Your Career Site in Minutes",
    description:
      "AI-powered career pages, job listings, and hiring workflows — all in one platform.",
    type: "website",
    siteName: "HireBase",
    locale: "en_US",
    url: "https://hirebase.dev",
  },
  twitter: {
    card: "summary_large_image",
    title: "HireBase — AI-Powered Career Site + Hiring Platform",
    description:
      "Build your career site in minutes. AI-powered job listings and hiring workflows.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
