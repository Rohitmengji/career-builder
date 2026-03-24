/**
 * Site Generator — Schema & Types
 *
 * Defines the structure for multi-page AI site generation.
 * Every generated site follows this schema exactly.
 */

import type { AiTone, AiIndustry, AiCompanyType, AiAudience, AiPageBlock } from "../types";

/* ================================================================== */
/*  Input — what the user provides                                     */
/* ================================================================== */

export interface SiteGenerationInput {
  companyName: string;
  industry: AiIndustry;
  companyType: AiCompanyType;
  tone: AiTone;
  hiringGoals?: string;
  audience?: AiAudience;
  /** User's free-form prompt / additional instructions */
  prompt?: string;
  /** Tenant ID for job data fetching (server-side only) */
  tenantId?: string;
}

/* ================================================================== */
/*  Page definition — what a generated page looks like                 */
/* ================================================================== */

export type PageType =
  | "home"
  | "jobs"
  | "about"
  | "culture"
  | "benefits"
  | "contact"
  | "careers";  // Alias for home — the main landing page

export interface GeneratedPage {
  slug: string;
  title: string;
  pageType: PageType;
  blocks: AiPageBlock[];
  /** Human-readable description of the page's purpose */
  description: string;
}

/* ================================================================== */
/*  Full site output                                                   */
/* ================================================================== */

export interface GeneratedSite {
  /** Company name used throughout */
  companyName: string;
  /** Pages in the site (ordered) */
  pages: GeneratedPage[];
  /** Summary of what was generated */
  summary: string;
  /** Warnings from validation */
  warnings: string[];
}

/* ================================================================== */
/*  Site plan — intermediate step (AI generates this first)            */
/* ================================================================== */

export interface SitePlan {
  pages: SitePagePlan[];
  brandVoice: string;
  colorScheme: string;
}

export interface SitePagePlan {
  slug: string;
  title: string;
  pageType: PageType;
  description: string;
  /** Block types to include on this page */
  blockTypes: string[];
}

/* ================================================================== */
/*  Page blueprints — default block structure per page type             */
/* ================================================================== */

export const PAGE_BLUEPRINTS: Record<PageType, {
  title: string;
  slug: string;
  description: string;
  blockTypes: string[];
}> = {
  home: {
    title: "Careers",
    slug: "careers",
    description: "Main career landing page — hero, social proof, why join us, culture, jobs, testimonials, stats, CTA",
    blockTypes: [
      "navbar",
      "hero",
      "social-proof",
      "features",
      "image-text-grid",
      "stats-counter",
      "testimonial",
      "accordion",
      "cta-button",
      "footer",
    ],
  },
  careers: {
    title: "Careers",
    slug: "careers",
    description: "Main career landing page with rich multi-section layout",
    blockTypes: [
      "navbar",
      "hero",
      "social-proof",
      "features",
      "image-text-grid",
      "stats-counter",
      "testimonial",
      "accordion",
      "cta-button",
      "footer",
    ],
  },
  jobs: {
    title: "Open Positions",
    slug: "jobs",
    description: "Job listing page with search, filters, categories, and talent network",
    blockTypes: [
      "navbar",
      "hero",
      "search-bar",
      "job-category",
      "job-list",
      "notification-banner",
      "join-talent-network",
      "cta-button",
      "footer",
    ],
  },
  about: {
    title: "About Us",
    slug: "about",
    description: "Company story, mission, leadership, and culture overview",
    blockTypes: [
      "navbar",
      "hero",
      "content",
      "video-and-text",
      "features",
      "image-text-grid",
      "team-grid",
      "stats-counter",
      "social-proof",
      "cta-button",
      "footer",
    ],
  },
  culture: {
    title: "Our Culture",
    slug: "culture",
    description: "Deep dive into company culture, values, team life, and employee stories",
    blockTypes: [
      "navbar",
      "hero",
      "features",
      "image-text-grid",
      "light-box",
      "social-proof",
      "testimonial",
      "video-and-text",
      "stats-counter",
      "cta-button",
      "footer",
    ],
  },
  benefits: {
    title: "Benefits & Perks",
    slug: "benefits",
    description: "Comprehensive benefits, perks, and total rewards breakdown",
    blockTypes: [
      "navbar",
      "hero",
      "features",
      "stats-counter",
      "accordion",
      "image-text-grid",
      "show-hide-tab",
      "testimonial",
      "social-proof",
      "cta-button",
      "footer",
    ],
  },
  contact: {
    title: "Contact Us",
    slug: "contact",
    description: "Contact information, office details, and talent network signup",
    blockTypes: [
      "navbar",
      "hero",
      "content",
      "image-text-grid",
      "join-talent-network",
      "accordion",
      "cta-button",
      "footer",
    ],
  },
};

/* ================================================================== */
/*  Limits                                                             */
/* ================================================================== */

export const SITE_LIMITS = {
  /** Max pages in a generated site */
  MAX_PAGES: 8,
  /** Max blocks per page */
  MAX_BLOCKS_PER_PAGE: 14,
  /** Max total blocks across all pages */
  MAX_TOTAL_BLOCKS: 80,
  /** Max concurrent AI calls for page generation */
  MAX_PARALLEL_PAGES: 3,
  /** Timeout per page generation (ms) */
  PAGE_TIMEOUT_MS: 30_000,
  /** Total site generation timeout (ms) */
  SITE_TIMEOUT_MS: 120_000,
  /** Pages that are ALWAYS generated */
  REQUIRED_PAGE_TYPES: ["home", "jobs", "about"] as PageType[],
} as const;
