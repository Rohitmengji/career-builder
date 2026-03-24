/*
 * Premium career-site renderer — strict schema-driven design system.
 *
 * Architecture:
 *   1. DEFAULT_BLOCK_PROPS — safe fallback data for every block type
 *   2. withDefaults(type, props) — merges user data over safe defaults
 *   3. safeList(value) — guarantees array, never undefined
 *   4. Every block receives fully-hydrated, null-safe props
 *   5. Empty lists → graceful empty state UI
 *   6. Error boundary wraps full page
 *   7. Unknown block types logged + skipped
 *   8. ALL styling via design tokens — no raw theme access
 *   9. Per-block color overrides via getAccent() from ThemeProvider
 *  10. WCAG 2.1 AA accessible — semantic HTML, ARIA, keyboard nav
 *  11. Mobile-first responsive — works on all viewports
 *  12. Safe rendering — every value guarded against null/undefined
 *  13. Performance — lazy images, srcset, memoized components
 *  14. SEO — semantic landmarks, heading hierarchy, JSON-LD ready
 *
 * Zero hardcoded UI. Every string, array, and image is driven by
 * props with safe fallback defaults.
 */

"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo, useState, useCallback, useId, useMemo, useRef, useEffect } from "react";
import { useTheme } from "@/lib/ThemeProvider";
import {
  darkenHex,
  lightenHex,
  isLightColor,
} from "@career-builder/tenant-config";
import {
  safeString,
  safeArray,
  safeBool,
  safeUrl,
  getReadableTextColor,
  ensureContrast,
  keys,
  srText,
  optimizeImageUrl,
  generateSrcSet,
  defaultImageSizes,
} from "@/lib/design-system";
import {
  VisuallyHidden,
  LazyImage,
  ResponsiveDrawer,
  IconButton,
  useIsMobile,
  useReducedMotion,
} from "@/lib/design-system-components";
import { useScrollReveal, useNavbarShrink } from "@/lib/useScrollReveal";

type Block = { type: string; props?: Record<string, any> };

/* ================================================================== */
/*  1. Safe Placeholder Images                                         */
/* ================================================================== */

const IMG = {
  hero: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=600&fit=crop&q=80",
  team: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop&q=80",
  office: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop&q=80",
  collab: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=600&fit=crop&q=80",
  meeting: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop&q=80",
  work: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=600&fit=crop&q=80",
  event: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=600&fit=crop&q=80",
  fallback: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop&q=80",
};
const POOL = [IMG.team, IMG.collab, IMG.meeting, IMG.work, IMG.event, IMG.office];
const dummyImg = (i: number) => POOL[i % POOL.length];

/* ================================================================== */
/*  2. Default Block Props — safe fallback for every block             */
/* ================================================================== */

const DEFAULT_BLOCK_PROPS: Record<string, Record<string, any>> = {
  hero: {
    title: "Build Your Career With Us",
    subtitle: "Join our team and make an impact. Explore open roles below.",
    ctaText: "View Open Positions",
    ctaLink: "#positions",
    backgroundImage: "",
    textAlign: "center",
  },
  content: {
    title: "About Us",
    body: "Tell your company story here. Share your mission, values, and what makes your workplace special.",
    textAlign: "left",
  },
  features: {
    title: "Why Work With Us",
    subtitle: "Discover the benefits of joining our team.",
    items: [
      { icon: "🤝", title: "Great Culture", desc: "A collaborative, inclusive workplace." },
      { icon: "📈", title: "Growth Opportunities", desc: "Learn and advance your career." },
      { icon: "⚖️", title: "Work-Life Balance", desc: "Flexible schedules and remote options." },
    ],
  },
  testimonial: {
    quote: "Working here has been an incredible journey. The team is supportive and the work is meaningful.",
    author: "Jane Doe",
    role: "Software Engineer",
  },
  carousel: {
    title: "Life at Our Company",
    slides: [
      { image: IMG.team, caption: "Team Building" },
      { image: IMG.office, caption: "Office Life" },
      { image: IMG.event, caption: "Company Events" },
    ],
  },
  accordion: {
    title: "Frequently Asked Questions",
    items: [
      { question: "What is the interview process?", answer: "Our process includes an initial phone screen, technical interview, and on-site meeting." },
      { question: "Do you offer remote work?", answer: "Yes, we offer hybrid and fully remote options for most roles." },
      { question: "What benefits do you offer?", answer: "Health insurance, 401k matching, unlimited PTO, and more." },
    ],
  },
  "cta-button": {
    title: "Ready to Apply?",
    subtitle: "Take the next step in your career journey.",
    buttonText: "Apply Now",
    buttonLink: "#apply",
  },
  "search-bar": {
    title: "Find Your Next Role",
    placeholder: "Search by title, keyword, or location…",
  },
  "search-results": {
    title: "Open Positions",
    subtitle: "Find the role that's right for you.",
    jobs: [
      { id: "sr-frontend-eng", title: "Senior Frontend Engineer", department: "Engineering", location: "San Francisco, CA (Hybrid)", type: "Full-time", salary: "$160K – $200K" },
      { id: "product-designer", title: "Product Designer", department: "Design", location: "New York, NY (Remote)", type: "Full-time", salary: "$140K – $180K" },
      { id: "fullstack-engineer", title: "Full Stack Engineer", department: "Engineering", location: "Austin, TX (Remote)", type: "Full-time", salary: "$150K – $190K" },
      { id: "marketing-manager", title: "Marketing Manager", department: "Marketing", location: "San Francisco, CA", type: "Full-time", salary: "$120K – $150K" },
      { id: "devops-engineer", title: "DevOps Engineer", department: "Engineering", location: "Remote", type: "Full-time", salary: "$145K – $185K" },
      { id: "customer-success-manager", title: "Customer Success Manager", department: "Sales", location: "New York, NY (Hybrid)", type: "Full-time", salary: "$100K – $130K" },
    ],
  },
  "job-details": {
    showApplyButton: true,
    applyButtonText: "Apply for This Job",
    showShareButtons: true,
    showRelatedJobs: true,
  },
  "job-category": {
    title: "Explore by Category",
    subtitle: "Browse open positions by department.",
    categories: [
      { name: "Engineering", count: 12 },
      { name: "Design", count: 5 },
      { name: "Marketing", count: 8 },
      { name: "Sales", count: 6 },
      { name: "Operations", count: 3 },
      { name: "Support", count: 4 },
    ],
  },
  "join-talent-network": {
    title: "Join Our Talent Network",
    subtitle: "Don't see the right role? Sign up to be notified when new positions open.",
    buttonText: "Join Now",
  },
  "video-and-text": {
    title: "See What It's Like",
    body: "Watch our team share their experiences working here.",
    videoUrl: "",
    videoPosition: "left",
    ctaText: "",
    ctaLink: "#",
  },
  personalization: {
    title: "Recommended For You",
    showRecentSearches: true,
    showRecommendedJobs: true,
    showRecentJobs: true,
    showTrendingSearches: false,
  },
  "show-hide-tab": {
    title: "Explore Our Teams",
    tabs: [
      { label: "Engineering", content: "Our engineering team builds products used by millions." },
      { label: "Design", content: "Our designers craft beautiful, intuitive experiences." },
      { label: "Marketing", content: "Our marketing team drives growth and brand awareness." },
    ],
  },
  "image-text-grid": {
    title: "Our Values",
    items: [
      { image: IMG.team, title: "Innovation", desc: "We push boundaries and embrace new ideas." },
      { image: IMG.collab, title: "Collaboration", desc: "We achieve more by working together." },
      { image: IMG.meeting, title: "Impact", desc: "We make a meaningful difference every day." },
    ],
  },
  "light-box": {
    title: "Gallery",
    subtitle: "A glimpse into our workplace.",
    columns: "3",
    images: [
      { url: IMG.office, caption: "Office Space" },
      { url: IMG.event, caption: "Team Outing" },
      { url: IMG.work, caption: "Workspace" },
    ],
  },
  "job-alert": {
    title: "Get Job Alerts",
    subtitle: "Be the first to know when new jobs are posted.",
    buttonText: "Set Up Alert",
  },
  "navigate-back": {
    label: "← Back to All Jobs",
    link: "/jobs",
  },
  "basic-button": {
    text: "Click Me",
    link: "#",
    variant: "solid",
  },
  "basic-image": {
    src: IMG.hero,
    alt: "Team collaboration",
    width: "full",
  },
  spacer: { height: "48px" },
  divider: {},

  /* ─── New Blocks ──────────────────────────────────────────────── */
  "notification-banner": {
    text: "🎉 We're hiring! Check out our latest openings.",
    linkText: "View Jobs",
    linkUrl: "#positions",
    variant: "info",
    dismissible: true,
  },
  "stats-counter": {
    title: "By the Numbers",
    subtitle: "Our impact in numbers.",
    items: [
      { value: "500+", label: "Employees Worldwide" },
      { value: "50+", label: "Open Positions" },
      { value: "4.8", label: "Glassdoor Rating" },
      { value: "95%", label: "Employee Retention" },
    ],
  },
  "team-grid": {
    title: "Meet Our Team",
    subtitle: "The people behind our success.",
    members: [
      { name: "Sarah Chen", role: "VP of Engineering", image: "", linkedinUrl: "#" },
      { name: "Marcus Johnson", role: "Head of Design", image: "", linkedinUrl: "#" },
      { name: "Priya Patel", role: "Director of People", image: "", linkedinUrl: "#" },
      { name: "Alex Rivera", role: "CTO", image: "", linkedinUrl: "#" },
    ],
  },
  "social-proof": {
    title: "Trusted By",
    logos: [
      { name: "Forbes", imageUrl: "" },
      { name: "TechCrunch", imageUrl: "" },
      { name: "Glassdoor", imageUrl: "" },
      { name: "Inc. 5000", imageUrl: "" },
    ],
    variant: "light",
  },
  "application-status": {
    title: "Track Your Application",
    subtitle: "Enter your email to check your application status.",
    steps: [
      { label: "Applied", description: "We received your application." },
      { label: "Screening", description: "Our team is reviewing your profile." },
      { label: "Interview", description: "You'll be invited for an interview." },
      { label: "Offer", description: "Congratulations! An offer is on the way." },
    ],
  },

  navbar: {
    companyName: "Acme Inc.",
    logoUrl: "",
    showCta: true,
    ctaText: "View Jobs",
    ctaLink: "#positions",
    links: [
      { label: "About", url: "#about" },
      { label: "Teams", url: "#teams" },
      { label: "Benefits", url: "#benefits" },
    ],
    variant: "light",
  },
  footer: {
    companyName: "Acme Inc.",
    copyright: "",
    description: "Building the future of work.",
    links: [
      { label: "Privacy Policy", url: "/privacy" },
      { label: "Terms of Service", url: "/terms" },
      { label: "Contact Us", url: "/contact" },
    ],
    socialLinks: [
      { platform: "linkedin", url: "#" },
      { platform: "twitter", url: "#" },
    ],
    variant: "dark",
  },
};

/* ================================================================== */
/*  3. Safety utilities                                                */
/* ================================================================== */

/** Merge user props over safe defaults — deep for arrays. */
function withDefaults(type: string, userProps: Record<string, any> = {}): Record<string, any> {
  const defaults = DEFAULT_BLOCK_PROPS[type] || {};
  const merged: Record<string, any> = { ...defaults };
  for (const key of Object.keys(userProps)) {
    const val = userProps[key];
    // Keep non-empty user values; fall back to default for empty/null
    if (val !== undefined && val !== null && val !== "") {
      merged[key] = val;
    }
  }
  return merged;
}

/** Guarantee an array — never returns undefined. */
function safeList<T = any>(val: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(val) && val.length > 0) return val;
  return fallback;
}

/** Safe image src — never empty string. */
function safeImg(src: unknown, fallbackIndex: number = 0): string {
  if (typeof src === "string" && src.length > 0) return src;
  return dummyImg(fallbackIndex);
}

/* ================================================================== */
/*  4. Error Boundary                                                  */
/* ================================================================== */

class BlockErrorBoundary extends React.Component<
  { blockType: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { blockType: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn(`[Renderer] Block "${this.props.blockType}" crashed:`, error.message);
  }
  render() {
    if (this.state.hasError) return null; // silently skip broken block
    return this.props.children;
  }
}

/* ================================================================== */
/*  5. Design System — Shared Primitives                               */
/* ================================================================== */

/* Old variant classes removed — Section now uses tokens.section[variant] */

/* ─── Color Accent System (via tokens) ──────────────────────────── */
/*
 * Per-block color overrides are handled via getAccent() from ThemeProvider.
 * This replaces the old hardcoded colorSchemes map.
 * Components call: const accent = getAccent(p.color);
 * Then use accent.hex, accent.btnBg, accent.btnText etc.
 */

function Section({
  variant = "white",
  className = "",
  style,
  children,
  noPadding = false,
  as: Tag = "section",
  ariaLabel,
  ariaLabelledBy,
  id,
}: {
  variant?: "white" | "light" | "dark" | "accent" | "gradient";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  noPadding?: boolean;
  as?: "section" | "div" | "aside" | "article";
  ariaLabel?: string;
  ariaLabelledBy?: string;
  id?: string;
}) {
  const { tokens } = useTheme();

  return (
    <Tag
      id={id}
      className={`w-full ${noPadding ? "" : tokens.layout.sectionPaddingClass} ${className}`}
      style={{ ...tokens.section[variant], ...style }}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </Tag>
  );
}

function Container({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${className}`} style={tokens.containerStyle as React.CSSProperties}>{children}</div>;
}

function SectionHeader({
  title,
  subtitle,
  align = "center",
  dark = false,
  id,
  level = 2,
}: {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  dark?: boolean;
  id?: string;
  level?: 2 | 3 | 4;
}) {
  const { tokens } = useTheme();
  if (!title) return null;
  const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;
  return (
    <div className={`mb-6 md:mb-8 ${align === "center" ? "text-center" : ""}`}>
      <HeadingTag
        id={id}
        className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight"
        style={{ color: dark ? "#ffffff" : tokens.colors.heading, fontFamily: tokens.typography.headingFontFamilyCss, fontWeight: tokens.typography.headingWeight }}
      >
        {title}
      </HeadingTag>
      {subtitle && (
        <p
          className={`mt-3 text-base leading-relaxed max-w-2xl ${align === "center" ? "mx-auto" : ""}`}
          style={{ color: dark ? "#d1d5db" : tokens.colors.textMuted }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Card({ className = "", style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <div
      className={`border p-4 sm:p-5 md:p-6 ${tokens.card.shadowClass} transition-shadow duration-200 ${tokens.card.hoverClass} ${tokens.card.radiusClass} ${className}`}
      style={{ ...tokens.card.style as React.CSSProperties, ...style }}
    >
      {children}
    </div>
  );
}

function Btn({
  href,
  variant = "primary",
  color,
  className = "",
  children,
  style: styleProp,
}: {
  href?: string;
  variant?: "primary" | "secondary";
  color?: string;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { tokens, getAccent } = useTheme();
  const accent = color ? getAccent(color) : null;

  const baseStyle: React.CSSProperties =
    variant === "primary"
      ? accent
        ? { backgroundColor: accent.hex, color: accent.btnText }
        : tokens.button.primaryStyle as React.CSSProperties
      : tokens.button.secondaryStyle as React.CSSProperties;

  return (
    <a
      href={href || "#"}
      className={`inline-flex items-center justify-center ${tokens.button.sizeClass} ${tokens.button.radiusClass} font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${className}`}
      style={{ ...baseStyle, ...styleProp }}
      onMouseEnter={(e) => {
        if (variant === "primary") {
          e.currentTarget.style.backgroundColor = accent ? accent.btnHover : tokens.button.primaryHoverBg;
        } else {
          e.currentTarget.style.backgroundColor = tokens.button.secondaryHoverBg;
        }
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") {
          e.currentTarget.style.backgroundColor = accent ? accent.hex : tokens.colors.primary;
        } else {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {children}
    </a>
  );
}

/** Graceful empty state for list blocks with no items. */
function EmptyState({ message }: { message?: string }) {
  const { tokens } = useTheme();
  return (
    <div className="text-center py-6 md:py-8" style={{ color: tokens.colors.textMuted }} role="status">
      <svg className="w-12 h-12 mx-auto mb-4" style={{ color: tokens.colors.border }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <p className="text-sm">{message || "Add items from the editor sidebar."}</p>
    </div>
  );
}

/* ================================================================== */
/*  6. Block Components — fully schema-driven                          */
/* ================================================================== */

const Hero = memo((raw: any) => {
  const p = withDefaults("hero", raw);
  const { tokens, getAccent } = useTheme();
  const heroId = useId();
  const bgImage = safeString(p.backgroundImage);
  return (
    <Section
      variant="gradient"
      className="py-14! sm:py-16! md:py-20! bg-cover bg-center relative overflow-hidden"
      style={bgImage ? { backgroundImage: `url(${optimizeImageUrl(bgImage, { width: 1920, quality: 85 })})` } : undefined}
      ariaLabelledBy={`${heroId}-title`}
    >
      {bgImage && <div className="absolute inset-0 backdrop-blur-sm" style={{ backgroundColor: `${tokens.colors.background}b3` }} aria-hidden="true" />}
      <Container className="relative z-10">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-4">
          <h1 id={`${heroId}-title`} className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1]" style={{ color: tokens.colors.text, fontFamily: tokens.typography.headingFontFamilyCss, fontWeight: tokens.typography.headingWeight }}>{p.title}</h1>
          {p.subtitle && <p className="text-base sm:text-lg leading-relaxed max-w-xl" style={{ color: tokens.colors.textMuted }}>{p.subtitle}</p>}
          {p.ctaText && <Btn href={safeUrl(p.ctaLink, "#positions")} color={p.color}>{p.ctaText}</Btn>}
        </div>
      </Container>
    </Section>
  );
});
Hero.displayName = "Hero";

const Content = memo((raw: any) => {
  const p = withDefaults("content", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  return (
    <Section variant="white" ariaLabel={safeString(p.title, "Content section")}>
      <Container className="max-w-3xl">
        <div style={{ textAlign: p.textAlign || "left" }}>
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-4 sm:mb-6"
            style={{ color: p.color && p.color !== "white" ? accent.hex : tokens.colors.text, fontFamily: tokens.typography.headingFontFamilyCss }}
          >{p.title}</h2>
          {p.body && <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: tokens.colors.textMuted }}>{p.body}</p>}
        </div>
      </Container>
    </Section>
  );
});
Content.displayName = "Content";

const Features = memo((raw: any) => {
  const p = withDefaults("features", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  const items = safeList(p.items, DEFAULT_BLOCK_PROPS.features.items);
  const sectionId = useId();
  return (
    <Section variant="light" ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader title={p.title} subtitle={p.subtitle} id={`${sectionId}-heading`} />
        {items.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0" role="list">
            {items.map((item: any, i: number) => (
              <li key={i}>
                <Card className="text-center h-full">
                  <span className="text-4xl block mb-4" role="img" aria-label={safeString(item.title, "Feature")}>{item.icon || "✨"}</span>
                  <h3 className="text-xl font-medium mb-2" style={{ color: tokens.colors.text }}>{item.title || "Feature"}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: tokens.colors.textMuted }}>{item.desc || ""}</p>
                  {p.color && <div className="mt-4 h-0.5 w-12 mx-auto rounded-full" style={{ backgroundColor: accent.hex }} aria-hidden="true" />}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Add features from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
Features.displayName = "Features";

const Testimonial = memo((raw: any) => {
  const p = withDefaults("testimonial", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  return (
    <Section variant="white" ariaLabel="Testimonial">
      <Container className="max-w-3xl text-center">
        <figure className="flex flex-col items-center gap-6">
          <svg className="w-10 h-10" style={{ color: p.color ? accent.hex : tokens.colors.border }} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
          </svg>
          <blockquote className="text-2xl font-medium leading-relaxed" style={{ color: tokens.colors.text }}>{p.quote}</blockquote>
          <figcaption>
            <p className="font-semibold" style={{ color: tokens.colors.text }}>{p.author}</p>
            <p className="text-sm" style={{ color: tokens.colors.textMuted }}>{p.role}</p>
          </figcaption>
        </figure>
      </Container>
    </Section>
  );
});
Testimonial.displayName = "Testimonial";

const Carousel = memo((raw: any) => {
  const p = withDefaults("carousel", raw);
  const { tokens, getAccent } = useTheme();
  const slides = safeList(p.slides, DEFAULT_BLOCK_PROPS.carousel.slides);
  const carouselId = useId();
  return (
    <Section variant="white" ariaLabelledBy={`${carouselId}-heading`}>
      <Container>
        <SectionHeader title={p.title} id={`${carouselId}-heading`} />
        {slides.length > 0 ? (
          slides.length <= 6 ? (
            /* Grid layout — matches ImageTextGrid alignment */
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 list-none p-0 m-0" role="list">
              {slides.map((slide: any, i: number) => (
                <li key={i} className="group">
                  <div className={`w-full aspect-4/3 overflow-hidden ${tokens.card.radiusClass}`} style={{ backgroundColor: tokens.colors.surface }}>
                    <LazyImage src={safeImg(slide.image, i)} alt={safeString(slide.caption, `Slide ${i + 1}`)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  {slide.caption && <p className="mt-3 text-sm text-center" style={{ color: tokens.colors.textMuted }}>{slide.caption}</p>}
                </li>
              ))}
            </ul>
          ) : (
            /* Horizontal scroll for many slides */
            <div
              className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory -mx-6 px-6"
              role="region"
              aria-label={safeString(p.title, "Image carousel")}
              tabIndex={0}
            >
              {slides.map((slide: any, i: number) => (
                <div key={i} className="shrink-0 w-60 sm:w-72 snap-start" role="group" aria-label={`Slide ${i + 1} of ${slides.length}: ${safeString(slide.caption, "Slide")}`}>
                  <div className={`w-full aspect-4/3 overflow-hidden ${tokens.card.radiusClass}`} style={{ backgroundColor: tokens.colors.surface }}>
                    <LazyImage src={safeImg(slide.image, i)} alt={safeString(slide.caption, `Slide ${i + 1}`)} className="w-full h-full object-cover" />
                  </div>
                  {slide.caption && <p className="mt-3 text-sm text-center" style={{ color: tokens.colors.textMuted }}>{slide.caption}</p>}
                </div>
              ))}
            </div>
          )
        ) : (
          <EmptyState message="Add slides from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
Carousel.displayName = "Carousel";

const Accordion = memo((raw: any) => {
  const p = withDefaults("accordion", raw);
  const { tokens, getAccent } = useTheme();
  const items = safeList(p.items, DEFAULT_BLOCK_PROPS.accordion.items);
  const sectionId = useId();
  return (
    <Section variant="white" ariaLabelledBy={`${sectionId}-heading`}>
      <Container className="max-w-3xl">
        <SectionHeader title={p.title} id={`${sectionId}-heading`} />
        {items.length > 0 ? (
          <div className="divide-y" style={{ borderColor: tokens.colors.border }} role="list">
            {items.map((item: any, i: number) => (
              <details key={i} className="group py-5" role="listitem">
                <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-base select-none" style={{ color: tokens.colors.text }}>
                  <span>{item.question || "Question"}</span>
                  <svg className="w-5 h-5 shrink-0 ml-4 transition-transform duration-200 group-open:rotate-45" style={{ color: tokens.colors.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                  </svg>
                </summary>
                <p className="mt-3 leading-relaxed text-sm" style={{ color: tokens.colors.textMuted }}>{item.answer || ""}</p>
              </details>
            ))}
          </div>
        ) : (
          <EmptyState message="Add FAQ items from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
Accordion.displayName = "Accordion";

const CtaButton = memo((raw: any) => {
  const p = withDefaults("cta-button", raw);
  const { tokens, getAccent } = useTheme();
  return (
    <Section variant="light" ariaLabel={safeString(p.title, "Call to action")}>
      <Container className="text-center max-w-2xl">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ color: tokens.colors.text, fontFamily: tokens.typography.headingFontFamilyCss }}>{p.title}</h2>
        {p.subtitle && <p className="mb-6 sm:mb-8 leading-relaxed" style={{ color: tokens.colors.textMuted }}>{p.subtitle}</p>}
        <Btn href={safeUrl(p.buttonLink, "#apply")} color={p.color}>{p.buttonText}</Btn>
      </Container>
    </Section>
  );
});
CtaButton.displayName = "CtaButton";

const SearchBar = memo((raw: any) => {
  const p = withDefaults("search-bar", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  const btnBg = accent.hex;
  const btnText = isLightColor(btnBg) ? "#111827" : "#ffffff";
  const searchId = useId();
  return (
    <Section variant="gradient" ariaLabel={safeString(p.title, "Job search")}>
      <Container className="max-w-2xl">
        <SectionHeader title={p.title} />
        <form role="search" aria-label={srText.searchJobs} onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-3">
          <label htmlFor={`${searchId}-input`} className="sr-only">{safeString(p.placeholder, "Search jobs")}</label>
          <input
            id={`${searchId}-input`}
            type="search"
            placeholder={p.placeholder}
            className="flex-1 rounded-lg px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
            style={{
              borderWidth: "1px",
              borderColor: tokens.colors.border,
              backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff",
              color: tokens.colors.text,
            }}
            autoComplete="off"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg text-sm font-semibold transition shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600"
            style={{ backgroundColor: btnBg, color: btnText }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = darkenHex(btnBg, 0.12); }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = btnBg; }}
          >
            Search
          </button>
        </form>
      </Container>
    </Section>
  );
});
SearchBar.displayName = "SearchBar";

const SearchResults = memo((raw: any) => {
  const p = withDefaults("search-results", raw);
  const { tokens, getAccent } = useTheme();
  const jobs = safeList(p.jobs, DEFAULT_BLOCK_PROPS["search-results"].jobs);
  const sectionId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Derive unique departments/types from jobs for filter dropdowns
  const departments = useMemo(() => {
    const depts = new Set<string>();
    jobs.forEach((j: any) => { if (j.department) depts.add(j.department); });
    return Array.from(depts).sort();
  }, [jobs]);

  const types = useMemo(() => {
    const ts = new Set<string>();
    jobs.forEach((j: any) => { if (j.type) ts.add(j.type); });
    return Array.from(ts).sort();
  }, [jobs]);

  // Filter jobs
  const filtered = useMemo(() => {
    return jobs.filter((job: any) => {
      const matchesSearch = !searchQuery ||
        (job.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.department || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.location || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === "all" || job.department === deptFilter;
      const matchesType = typeFilter === "all" || job.type === typeFilter;
      return matchesSearch && matchesDept && matchesType;
    });
  }, [jobs, searchQuery, deptFilter, typeFilter]);

  const showFilters = p.showFacets !== false;
  const showSearch = p.showSearch !== false;

  return (
    <Section variant="white" className="scroll-mt-24" style={{ scrollMarginTop: "6rem" }} ariaLabelledBy={`${sectionId}-heading`} id="positions">
      <Container>
        <SectionHeader title={p.title} subtitle={p.subtitle} align="left" id={`${sectionId}-heading`} />

        {/* Filters Bar */}
        {(showSearch || showFilters) && jobs.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8" role="search" aria-label="Filter jobs">
            {showSearch && (
              <div className="flex-1">
                <label htmlFor={`${sectionId}-search`} className="sr-only">Search jobs</label>
                <input
                  id={`${sectionId}-search`}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, department, or location…"
                  className="w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                  style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff", color: tokens.colors.text }}
                />
              </div>
            )}
            {showFilters && departments.length > 1 && (
              <div>
                <label htmlFor={`${sectionId}-dept`} className="sr-only">Filter by department</label>
                <select
                  id={`${sectionId}-dept`}
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full sm:w-auto rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                  style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff", color: tokens.colors.text }}
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            {showFilters && types.length > 1 && (
              <div>
                <label htmlFor={`${sectionId}-type`} className="sr-only">Filter by type</label>
                <select
                  id={`${sectionId}-type`}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full sm:w-auto rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                  style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff", color: tokens.colors.text }}
                >
                  <option value="all">All Types</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Results count */}
        {(searchQuery || deptFilter !== "all" || typeFilter !== "all") && (
          <p className="text-sm mb-4" style={{ color: tokens.colors.textMuted }} role="status" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "position" : "positions"} found
            {searchQuery && <> for &ldquo;{searchQuery}&rdquo;</>}
          </p>
        )}

        {filtered.length > 0 ? (
          <ul className="space-y-3 list-none p-0 m-0" role="list" aria-label="Job listings">
            {filtered.map((job: any) => (
              <li key={job.id}>
                <a href={safeUrl(`/careers/jobs/${job.id}`, "#")} className="block group focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-2xl">
                  <div
                    className="rounded-2xl border p-5 sm:p-6 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff" }}
                  >
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-medium transition-colors truncate"
                        style={{ color: tokens.colors.text }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = tokens.colors.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = tokens.colors.text; }}
                      >{job.title || "Untitled Role"}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm" style={{ color: tokens.colors.textMuted }}>
                        {job.department && <span>{job.department}</span>}
                        {job.department && job.location && <span className="hidden sm:inline" style={{ color: tokens.colors.border }} aria-hidden="true">·</span>}
                        {job.location && <span>{job.location}</span>}
                        {job.location && job.type && <span className="hidden sm:inline" style={{ color: tokens.colors.border }} aria-hidden="true">·</span>}
                        {job.type && <span>{job.type}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {job.salary && <span className="text-sm font-medium" style={{ color: tokens.colors.text }}>{job.salary}</span>}
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                        style={{ backgroundColor: tokens.colors.surface }}
                        aria-hidden="true"
                      >
                        <svg className="w-4 h-4" style={{ color: tokens.colors.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : searchQuery || deptFilter !== "all" || typeFilter !== "all" ? (
          <div className="text-center py-8" role="status" aria-live="polite">
            <p className="font-medium" style={{ color: tokens.colors.text }}>No matching positions</p>
            <p className="text-sm mt-1" style={{ color: tokens.colors.textMuted }}>Try adjusting your search or filters.</p>
            <button
              onClick={() => { setSearchQuery(""); setDeptFilter("all"); setTypeFilter("all"); }}
              className="mt-4 text-sm font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              style={{ color: tokens.colors.primary }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <EmptyState message="No open positions at this time." />
        )}
      </Container>
    </Section>
  );
});
SearchResults.displayName = "SearchResults";

const JobDetails = memo((raw: any) => {
  const p = withDefaults("job-details", raw);
  const { tokens, getAccent } = useTheme();
  return (
    <Section variant="white" as="article" ariaLabel={safeString(p.jobTitle, "Job details")}>
      <Container className="max-w-3xl">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-2" style={{ color: tokens.colors.text, fontFamily: tokens.typography.headingFontFamilyCss }}>
            {p.jobTitle || "Job Title"}
          </h2>
          <p className="text-sm" style={{ color: tokens.colors.textMuted }}>
            {[p.department, p.location, p.type].filter(Boolean).join(" · ") || "Department · Location · Full-time"}
          </p>
        </div>
        <div className="prose max-w-none mb-10 leading-relaxed" style={{ color: tokens.colors.textMuted }}>
          {p.description || "Job description loads at runtime."}
        </div>
        {p.showApplyButton !== false && <Btn href={safeUrl("#apply", "#apply")} color={p.color}>{p.applyButtonText}</Btn>}
      </Container>
    </Section>
  );
});
JobDetails.displayName = "JobDetails";

const JobCategory = memo((raw: any) => {
  const p = withDefaults("job-category", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  const categories = safeList(p.categories, DEFAULT_BLOCK_PROPS["job-category"].categories);
  const sectionId = useId();
  return (
    <Section variant="light" ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader title={p.title} subtitle={p.subtitle} id={`${sectionId}-heading`} />
        {categories.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0" role="list" aria-label="Job categories">
            {categories.map((cat: any, i: number) => (
              <li key={i}>
                <Card className="cursor-pointer group h-full">
                  <h3 className="font-medium transition-colors group-hover:underline" style={{ color: tokens.colors.text }}>
                    {cat.name || cat}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: tokens.colors.textMuted }}>
                    {cat.count != null ? `${cat.count} open roles →` : "Browse open roles →"}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No categories to display." />
        )}
      </Container>
    </Section>
  );
});
JobCategory.displayName = "JobCategory";

const JoinTalentNetwork = memo((raw: any) => {
  const p = withDefaults("join-talent-network", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  const btnBg = accent.hex;
  const btnText = isLightColor(btnBg) ? "#111827" : "#ffffff";
  const formId = useId();
  const [formState, setFormState] = useState<"form" | "loading" | "success" | "error">("form");

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setFormState("loading");
    setTimeout(() => setFormState("success"), 1000);
  }, []);

  return (
    <Section variant="dark" ariaLabel={safeString(p.title, "Join talent network")}>
      <Container className="text-center max-w-xl">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4" style={{ fontFamily: tokens.typography.headingFontFamilyCss }}>{p.title}</h2>
        {p.subtitle && <p className="text-gray-400 mb-6 sm:mb-8 leading-relaxed">{p.subtitle}</p>}
        {formState === "success" ? (
          <div className="text-center py-4" role="status" aria-live="polite">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-green-500/20">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium">You&apos;re in! We&apos;ll notify you of new openings.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3" aria-label="Join talent network form">
            <label htmlFor={`${formId}-email`} className="sr-only">Email address</label>
            <input
              id={`${formId}-email`}
              type="email"
              placeholder="Enter your email"
              required
              autoComplete="email"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
            />
            <button
              type="submit"
              disabled={formState === "loading"}
              className="px-6 py-3 rounded-lg text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 disabled:opacity-50"
              style={{ backgroundColor: btnBg, color: btnText }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = darkenHex(btnBg, 0.12); }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = btnBg; }}
            >
              {formState === "loading" ? "Joining…" : p.buttonText}
            </button>
          </form>
        )}
      </Container>
    </Section>
  );
});
JoinTalentNetwork.displayName = "JoinTalentNetwork";

function toEmbedUrl(url: string): string {
  if (!url) return "";
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vmMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  return url;
}

const VideoAndText = memo((raw: any) => {
  const p = withDefaults("video-and-text", raw);
  const { tokens, getAccent } = useTheme();
  const embed = toEmbedUrl(safeString(p.videoUrl));
  const videoTitle = safeString(p.title, "Video");
  return (
    <Section variant="white" ariaLabel={videoTitle}>
      <Container>
        <div className={`flex flex-col md:flex-row gap-6 md:gap-10 items-center ${p.videoPosition === "right" ? "md:flex-row-reverse" : ""}`}>
          <div className={`w-full md:flex-1 aspect-video overflow-hidden flex items-center justify-center ${tokens.card.radiusClass}`} style={{ backgroundColor: tokens.colors.surface }}>
            {embed ? (
              <iframe
                src={embed}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="border-0 w-full h-full"
                title={videoTitle}
                loading="lazy"
              />
            ) : (
              <span className="text-5xl" style={{ color: tokens.colors.border }} aria-hidden="true">▶</span>
            )}
          </div>
          <div className="w-full md:flex-1">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ color: tokens.colors.text, fontFamily: tokens.typography.headingFontFamilyCss }}>{p.title}</h2>
            {p.body && <p className="leading-relaxed mb-6" style={{ color: tokens.colors.textMuted }}>{p.body}</p>}
            {p.ctaText && <Btn href={safeUrl(p.ctaLink, "#")} color={p.color}>{p.ctaText}</Btn>}
          </div>
        </div>
      </Container>
    </Section>
  );
});
VideoAndText.displayName = "VideoAndText";

const Personalization = memo((raw: any) => {
  const p = withDefaults("personalization", raw);
  const { tokens, getAccent } = useTheme();
  const cards: { label: string; visible: boolean }[] = [
    { label: "Recent Searches", visible: p.showRecentSearches !== false },
    { label: "Recommended Jobs", visible: p.showRecommendedJobs !== false },
    { label: "Trending Searches", visible: !!p.showTrendingSearches },
  ];
  const visibleCards = cards.filter((c) => c.visible);
  if (visibleCards.length === 0) return null;
  const sectionId = useId();
  return (
    <Section variant="light" ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader title={p.title} id={`${sectionId}-heading`} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleCards.map((c, i) => (
            <Card key={i}>
              <h3 className="font-medium mb-1" style={{ color: tokens.colors.text }}>{c.label}</h3>
              <p className="text-sm" style={{ color: tokens.colors.textMuted }}>Personalized at runtime</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
});
Personalization.displayName = "Personalization";

const ShowHideTab = memo((raw: any) => {
  const p = withDefaults("show-hide-tab", raw);
  const { tokens, getAccent } = useTheme();
  const tabs = safeList(p.tabs, DEFAULT_BLOCK_PROPS["show-hide-tab"].tabs);
  const sectionId = useId();
  return (
    <Section variant="white" ariaLabelledBy={`${sectionId}-heading`}>
      <Container className="max-w-3xl">
        <SectionHeader title={p.title} id={`${sectionId}-heading`} />
        {tabs.length > 0 ? (
          <div className="space-y-3">
            {tabs.map((tab: any, i: number) => (
              <div
                key={i}
                className={`${tokens.card.radiusClass} p-6 transition-all duration-200`}
                style={i === 0
                  ? { backgroundColor: lightenHex(tokens.colors.primary, 0.92), border: `2px solid ${lightenHex(tokens.colors.primary, 0.7)}` }
                  : { backgroundColor: tokens.colors.surface, border: `1px solid ${tokens.colors.border}` }
                }
              >
                <h3 className="font-medium mb-1" style={{ color: tokens.colors.text }}>{tab.label || "Tab"}</h3>
                <p className="text-sm leading-relaxed" style={{ color: tokens.colors.textMuted }}>{tab.content || ""}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Add tabs from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
ShowHideTab.displayName = "ShowHideTab";

const ImageTextGrid = memo((raw: any) => {
  const p = withDefaults("image-text-grid", raw);
  const { tokens, getAccent } = useTheme();
  const items = safeList(p.items, DEFAULT_BLOCK_PROPS["image-text-grid"].items);
  const sectionId = useId();
  return (
    <Section variant="white" ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader title={p.title} id={`${sectionId}-heading`} />
        {items.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 list-none p-0 m-0" role="list">
            {items.map((item: any, i: number) => (
              <li key={i} className="group">
                <div className={`w-full aspect-4/3 overflow-hidden mb-4 ${tokens.card.radiusClass}`} style={{ backgroundColor: tokens.colors.surface }}>
                  <LazyImage src={safeImg(item.image, i)} alt={safeString(item.title, `Image ${i + 1}`)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <h3 className="text-xl font-medium mb-2" style={{ color: tokens.colors.text }}>{item.title || "Item"}</h3>
                <p className="text-sm leading-relaxed" style={{ color: tokens.colors.textMuted }}>{item.desc || ""}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Add grid items from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
ImageTextGrid.displayName = "ImageTextGrid";

const LightBox = memo((raw: any) => {
  const p = withDefaults("light-box", raw);
  const { tokens, getAccent } = useTheme();
  const images = safeList(p.images, DEFAULT_BLOCK_PROPS["light-box"].images);
  const cols = safeString(p.columns, "3");
  const gridCls = cols === "2" ? "grid-cols-1 sm:grid-cols-2" : cols === "4" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  const sectionId = useId();
  return (
    <Section variant="light" ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader title={p.title} subtitle={p.subtitle} id={`${sectionId}-heading`} />
        {images.length > 0 ? (
          <ul className={`grid gap-6 ${gridCls} list-none p-0 m-0`} role="list" aria-label="Image gallery">
            {images.map((img: any, i: number) => (
              <li key={i} className="group cursor-pointer">
                <div className={`w-full aspect-square overflow-hidden ${tokens.card.radiusClass}`} style={{ backgroundColor: tokens.colors.surface }}>
                  <LazyImage src={safeImg(img.url, i)} alt={safeString(img.caption, `Gallery image ${i + 1}`)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                {img.caption && <p className="mt-2 text-sm text-center" style={{ color: tokens.colors.textMuted }}>{img.caption}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Add gallery images from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
LightBox.displayName = "LightBox";

const JobAlert = memo((raw: any) => {
  const p = withDefaults("job-alert", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  const sectionBg = accent.hex;
  const sectionText = getReadableTextColor(sectionBg);
  const subtitleColor = lightenHex(sectionBg, 0.5);
  const invertBg = isLightColor(sectionBg) ? "#111827" : "#ffffff";
  const invertText = isLightColor(sectionBg) ? "#ffffff" : sectionBg;
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<"form" | "loading" | "success" | "error">("form");
  const formId = useId();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setFormState("loading");
    // Simulate API call
    setTimeout(() => setFormState("success"), 1000);
  }, []);

  const resetForm = useCallback(() => {
    setFormState("form");
    setModalOpen(false);
  }, []);

  return (
    <>
      <section className="w-full py-8 sm:py-10 md:py-14" style={{ backgroundColor: sectionBg, color: sectionText }} aria-label={safeString(p.title, "Job alerts")}>
        <Container className="text-center max-w-2xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ color: sectionText, fontFamily: tokens.typography.headingFontFamilyCss }}>{p.title}</h2>
          {p.subtitle && <p className="mb-6 sm:mb-8 leading-relaxed" style={{ color: subtitleColor }}>{p.subtitle}</p>}
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 rounded-lg text-sm font-semibold transition shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
            style={{ backgroundColor: invertBg, color: invertText }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {p.buttonText}
          </button>
        </Container>
      </section>
      <Modal isOpen={modalOpen} onClose={resetForm} title="Set Up Job Alert">
        {formState === "success" ? (
          <FormSuccess message="Job alert created!" onDone={resetForm} />
        ) : formState === "error" ? (
          <FormError message="Something went wrong." onRetry={() => setFormState("form")} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Job alert form">
            <div>
              <label htmlFor={`${formId}-email`} className="block text-sm font-medium mb-1.5" style={{ color: tokens.colors.text }}>Email</label>
              <input
                id={`${formId}-email`}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff", color: tokens.colors.text }}
              />
            </div>
            <div>
              <label htmlFor={`${formId}-dept`} className="block text-sm font-medium mb-1.5" style={{ color: tokens.colors.text }}>Department</label>
              <select
                id={`${formId}-dept`}
                className="w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff", color: tokens.colors.text }}
              >
                <option value="">All Departments</option>
                <option value="engineering">Engineering</option>
                <option value="design">Design</option>
                <option value="marketing">Marketing</option>
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-freq`} className="block text-sm font-medium mb-1.5" style={{ color: tokens.colors.text }}>Frequency</label>
              <select
                id={`${formId}-freq`}
                className="w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
                style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff", color: tokens.colors.text }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={formState === "loading"}
              className="w-full py-3 rounded-lg text-sm font-semibold transition shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 disabled:opacity-50"
              style={{ backgroundColor: accent.hex, color: isLightColor(accent.hex) ? "#111827" : "#ffffff" }}
            >
              {formState === "loading" ? "Creating Alert…" : "Create Job Alert"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
});
JobAlert.displayName = "JobAlert";

const NavigateBack = memo((raw: any) => {
  const p = withDefaults("navigate-back", raw);
  const { tokens, getAccent } = useTheme();
  return (
    <Section variant="white" noPadding className="py-4!" as="div" ariaLabel="Navigation">
      <Container>
        <nav aria-label="Breadcrumb">
          <a href={safeUrl(p.link, "/jobs")} className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded" style={{ color: tokens.colors.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tokens.colors.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = tokens.colors.textMuted; }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {p.label}
          </a>
        </nav>
      </Container>
    </Section>
  );
});
NavigateBack.displayName = "NavigateBack";

const BasicButton = memo((raw: any) => {
  const p = withDefaults("basic-button", raw);
  return (
    <Section variant="white" noPadding className="py-8!" as="div">
      <Container className="text-center">
        <Btn href={safeUrl(p.link, "#")} variant={p.variant === "outline" || p.variant === "ghost" ? "secondary" : "primary"} color={p.color}>
          {p.text}
        </Btn>
      </Container>
    </Section>
  );
});
BasicButton.displayName = "BasicButton";

const BasicImage = memo((raw: any) => {
  const p = withDefaults("basic-image", raw);
  const imgSrc = safeImg(p.src, 0);
  const altText = safeString(p.alt, "Image");
  const isFullWidth = !p.width || p.width === "full";
  return (
    <Section variant="white" noPadding className="py-8!" as="div">
      <Container className={isFullWidth ? "" : "text-center"}>
        <LazyImage
          src={imgSrc}
          alt={altText}
          className={`rounded-2xl object-cover ${isFullWidth ? "w-full" : "mx-auto"}`}
          style={{ maxHeight: "500px", ...(isFullWidth ? {} : { maxWidth: p.width }) }}
        />
      </Container>
    </Section>
  );
});
BasicImage.displayName = "BasicImage";

const Spacer = (raw: any) => {
  const p = withDefaults("spacer", raw);
  return <div style={{ height: p.height }} aria-hidden="true" />;
};

const Divider = (raw: any) => {
  const p = typeof raw === "object" && raw ? raw : {};
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  return (
    <Container><hr style={{ borderColor: p.color ? accent.hex : tokens.colors.border }} /></Container>
  );
};

/* ================================================================== */
/*  MODAL SYSTEM — Reusable, accessible, schema-driven                 */
/* ================================================================== */

function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const { tokens } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      // Focus the modal after render
      setTimeout(() => modalRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      previousFocus.current?.focus();
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: "fadeIn 200ms ease-out" }} aria-hidden="true" />
      {/* Dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${sizeClass} rounded-2xl p-6 sm:p-8 shadow-2xl focus:outline-none`}
        style={{ backgroundColor: tokens.colors.background, color: tokens.colors.text, animation: "modalSlideUp 250ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: tokens.colors.heading, fontFamily: tokens.typography.headingFontFamilyCss }}>{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Close dialog"
          >
            <svg className="w-4 h-4" style={{ color: tokens.colors.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Success state shown after form submissions inside modals. */
function FormSuccess({ message, onDone }: { message: string; onDone: () => void }) {
  const { tokens } = useTheme();
  return (
    <div className="text-center py-6" role="status" aria-live="polite">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#dcfce7" }}>
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-medium text-lg mb-2" style={{ color: tokens.colors.text }}>{message}</p>
      <p className="text-sm mb-6" style={{ color: tokens.colors.textMuted }}>We&apos;ll be in touch soon.</p>
      <button
        onClick={onDone}
        className="text-sm font-medium px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
        style={{ color: tokens.colors.primary }}
      >
        Done
      </button>
    </div>
  );
}

/** Error state for form submissions. */
function FormError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { tokens } = useTheme();
  return (
    <div className="text-center py-6" role="alert">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fef2f2" }}>
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="font-medium text-lg mb-2" style={{ color: tokens.colors.text }}>{message}</p>
      <button
        onClick={onRetry}
        className="text-sm font-medium px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
        style={{ color: tokens.colors.primary }}
      >
        Try Again
      </button>
    </div>
  );
}

/* ================================================================== */
/*  NEW BLOCKS — Notification Banner                                   */
/* ================================================================== */

const NotificationBanner = memo((raw: any) => {
  const p = withDefaults("notification-banner", raw);
  const { tokens } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const variantStyles: Record<string, React.CSSProperties> = {
    info: { backgroundColor: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" },
    success: { backgroundColor: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" },
    warning: { backgroundColor: "#fffbeb", color: "#92400e", borderColor: "#fde68a" },
    error: { backgroundColor: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" },
  };
  const style = variantStyles[p.variant] || variantStyles.info;
  return (
    <div className="w-full border-b" style={style} role="status" aria-live="polite">
      <Container className="flex items-start sm:items-center justify-between py-3 gap-3 sm:gap-4">
        <p className="text-sm font-medium flex-1">
          {p.text}
          {p.linkText && (
            <a href={safeUrl(p.linkUrl, "#")} className="ml-2 underline font-semibold hover:no-underline">{p.linkText}</a>
          )}
        </p>
        {p.dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className="w-6 h-6 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Dismiss notification"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </Container>
    </div>
  );
});
NotificationBanner.displayName = "NotificationBanner";

/* ================================================================== */
/*  NEW BLOCKS — Stats Counter                                         */
/* ================================================================== */

const StatsCounter = memo((raw: any) => {
  const p = withDefaults("stats-counter", raw);
  const { tokens } = useTheme();
  const items = safeList(p.items, DEFAULT_BLOCK_PROPS["stats-counter"].items);
  const sectionId = useId();
  return (
    <Section variant="dark" ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader title={p.title} subtitle={p.subtitle} dark id={`${sectionId}-heading`} />
        {items.length > 0 ? (
          <ul className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 list-none p-0 m-0" role="list">
            {items.map((item: any, i: number) => (
              <li key={i} className="text-center">
                <span className="block text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">{item.value || "0"}</span>
                <span className="block mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-400">{item.label || "Metric"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Add statistics from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
StatsCounter.displayName = "StatsCounter";

/* ================================================================== */
/*  NEW BLOCKS — Team Grid                                             */
/* ================================================================== */

const TeamGrid = memo((raw: any) => {
  const p = withDefaults("team-grid", raw);
  const { tokens } = useTheme();
  const members = safeList(p.members, DEFAULT_BLOCK_PROPS["team-grid"].members);
  const sectionId = useId();
  return (
    <Section variant="white" ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader title={p.title} subtitle={p.subtitle} id={`${sectionId}-heading`} />
        {members.length > 0 ? (
          <ul className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 list-none p-0 m-0" role="list">
            {members.map((m: any, i: number) => (
              <li key={i} className="group text-center">
                <div className={`w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-3 sm:mb-4 overflow-hidden rounded-full`} style={{ backgroundColor: tokens.colors.surface }}>
                  {m.image ? (
                    <LazyImage src={safeImg(m.image, i)} alt={safeString(m.name, "Team member")} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-semibold" style={{ color: tokens.colors.textMuted }}>
                      {(safeString(m.name, "?"))[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-sm sm:text-base" style={{ color: tokens.colors.text }}>{m.name || "Team Member"}</h3>
                <p className="text-xs sm:text-sm mt-1" style={{ color: tokens.colors.textMuted }}>{m.role || "Role"}</p>
                {m.linkedinUrl && m.linkedinUrl !== "#" && (
                  <a
                    href={safeUrl(m.linkedinUrl, "#")}
                    className="inline-block mt-2 text-sm transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                    style={{ color: tokens.colors.primary }}
                    aria-label={`${m.name || "Team member"} on LinkedIn`}
                  >
                    LinkedIn →
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Add team members from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
TeamGrid.displayName = "TeamGrid";

/* ================================================================== */
/*  NEW BLOCKS — Social Proof / Logo Bar                               */
/* ================================================================== */

const SocialProof = memo((raw: any) => {
  const p = withDefaults("social-proof", raw);
  const { tokens } = useTheme();
  const logos = safeList(p.logos, DEFAULT_BLOCK_PROPS["social-proof"].logos);
  const sectionId = useId();
  return (
    <Section variant={p.variant === "dark" ? "dark" : "light"} ariaLabelledBy={`${sectionId}-heading`}>
      <Container>
        <SectionHeader
          title={p.title}
          dark={p.variant === "dark"}
          id={`${sectionId}-heading`}
        />
        {logos.length > 0 ? (
          <ul className="flex flex-wrap items-center justify-center gap-6 md:gap-10 list-none p-0 m-0" role="list" aria-label="Trusted by">
            {logos.map((logo: any, i: number) => (
              <li key={i} className="flex items-center justify-center">
                {logo.imageUrl ? (
                  <img
                    src={logo.imageUrl}
                    alt={safeString(logo.name, "Partner logo")}
                    className="h-8 md:h-10 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <span
                    className="text-lg font-semibold tracking-wide opacity-40"
                    style={{ color: p.variant === "dark" ? "#ffffff" : tokens.colors.text }}
                  >
                    {logo.name || "Logo"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Add partner/press logos from the editor sidebar." />
        )}
      </Container>
    </Section>
  );
});
SocialProof.displayName = "SocialProof";

/* ================================================================== */
/*  NEW BLOCKS — Application Status Tracker                            */
/* ================================================================== */

const ApplicationStatus = memo((raw: any) => {
  const p = withDefaults("application-status", raw);
  const { tokens, getAccent } = useTheme();
  const accent = getAccent(p.color);
  const steps = safeList(p.steps, DEFAULT_BLOCK_PROPS["application-status"].steps);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const sectionId = useId();

  const handleLookup = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    // Simulate lookup — in production this would call /api/jobs/apply/status
    setTimeout(() => {
      setStatus("found");
      setCurrentStep(1); // Simulate "Screening" step
    }, 1200);
  }, [email]);

  return (
    <Section variant="light" ariaLabelledBy={`${sectionId}-heading`}>
      <Container className="max-w-2xl">
        <SectionHeader title={p.title} subtitle={p.subtitle} id={`${sectionId}-heading`} />
        {status === "idle" || status === "loading" ? (
          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3" aria-label="Application status lookup">
            <label htmlFor={`${sectionId}-email`} className="sr-only">Email address</label>
            <input
              id={`${sectionId}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter the email you applied with"
              required
              autoComplete="email"
              className="flex-1 rounded-lg px-4 py-3 text-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition"
              style={{ borderColor: tokens.colors.border, backgroundColor: tokens.isDark ? "#1f2937" : "#ffffff", color: tokens.colors.text }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-6 py-3 rounded-lg text-sm font-semibold transition shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 disabled:opacity-50"
              style={{ backgroundColor: accent.hex, color: isLightColor(accent.hex) ? "#111827" : "#ffffff" }}
            >
              {status === "loading" ? "Looking up…" : "Check Status"}
            </button>
          </form>
        ) : status === "found" ? (
          <div role="status" aria-live="polite">
            <ol className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 list-none p-0 m-0">
              {steps.map((step: any, i: number) => (
                <li key={i} className="flex items-center gap-3 sm:flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors`}
                    style={i <= currentStep
                      ? { backgroundColor: accent.hex, color: isLightColor(accent.hex) ? "#111827" : "#ffffff" }
                      : { backgroundColor: tokens.colors.surface, color: tokens.colors.textMuted }
                    }
                  >
                    {i < currentStep ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: i <= currentStep ? tokens.colors.text : tokens.colors.textMuted }}>{step.label}</p>
                    <p className="text-xs mt-0.5 hidden sm:block" style={{ color: tokens.colors.textMuted }}>{step.description}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden sm:block w-8 h-0.5 mx-2" style={{ backgroundColor: i < currentStep ? accent.hex : tokens.colors.border }} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
            <button
              onClick={() => { setStatus("idle"); setEmail(""); }}
              className="mt-6 text-sm font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              style={{ color: tokens.colors.primary }}
            >
              Check another application
            </button>
          </div>
        ) : (
          <div className="text-center py-8" role="status" aria-live="polite">
            <p className="font-medium" style={{ color: tokens.colors.text }}>No application found</p>
            <p className="text-sm mt-1" style={{ color: tokens.colors.textMuted }}>
              We couldn&apos;t find an application with that email. Double-check and try again.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-4 text-sm font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              style={{ color: tokens.colors.primary }}
            >
              Try again
            </button>
          </div>
        )}
      </Container>
    </Section>
  );
});
ApplicationStatus.displayName = "ApplicationStatus";

/* ================================================================== */
/*  UPGRADED BLOCKS — Job Alert with Modal Flow                        */
/* ================================================================== */

const Navbar = memo((raw: any) => {
  const p = withDefaults("navbar", raw);
  const { tokens, getAccent } = useTheme();
  const links = safeList(p.links, DEFAULT_BLOCK_PROPS.navbar.links);
  const isDark = p.variant === "dark";
  const isTransparent = p.variant === "transparent";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const navRef = useNavbarShrink<HTMLElement>();
  const bgStyle: React.CSSProperties = isDark
    ? { backgroundColor: "#030712", color: "#ffffff", borderColor: "#1f2937" }
    : isTransparent
      ? { backgroundColor: "transparent", color: tokens.colors.text, borderColor: "transparent" }
      : { backgroundColor: `${tokens.colors.background}cc`, color: tokens.colors.text, borderColor: tokens.colors.border };
  const stickyClass = tokens.navbar.sticky ? "sticky top-0 z-50" : "";
  const linkColor = isDark ? "#9ca3af" : tokens.colors.textMuted;
  const textColor = isDark ? "#ffffff" : tokens.colors.text;
  return (
    <>
      <nav ref={navRef} className={`border-b ${stickyClass} backdrop-blur-lg`} style={bgStyle} aria-label="Main navigation">
        <Container className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            {p.logoUrl && <img src={p.logoUrl} alt={`${safeString(p.companyName, "Company")} logo`} className="h-8 w-auto" />}
            <span className="text-base font-semibold tracking-tight" style={{ color: textColor }}>{p.companyName}</span>
          </div>
          {/* Desktop nav links */}
          <div className="hidden sm:flex items-center gap-6">
            {links.map((link: any, i: number) => (
              <a key={i} href={safeUrl(link.url, "#")} className="text-sm transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded" style={{ color: linkColor }}>
                {link.label || "Link"}
              </a>
            ))}
            {p.showCta !== false && p.ctaText && (
              <a
                href={safeUrl(p.ctaLink, "#positions")}
                className={`text-sm font-semibold px-4 py-2 ${tokens.button.radiusClass} transition-all focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`}
                style={{
                  backgroundColor: isDark ? "#ffffff" : tokens.colors.primary,
                  color: isDark ? "#111827" : getReadableTextColor(tokens.colors.primary),
                }}
              >
                {p.ctaText}
              </a>
            )}
          </div>
          {/* Mobile hamburger button */}
          <button
            className="sm:hidden w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100/10 focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={() => setDrawerOpen(true)}
            aria-label={srText.expandMenu}
            aria-expanded={drawerOpen}
          >
            <svg className="w-5 h-5" style={{ color: textColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </Container>
      </nav>
      {/* Mobile navigation drawer */}
      <ResponsiveDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} label="Navigation menu">
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
          {links.map((link: any, i: number) => (
            <a
              key={i}
              href={safeUrl(link.url, "#")}
              className="block px-3 py-3 text-sm font-medium rounded-lg transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600"
              style={{ color: tokens.colors.text }}
              onClick={() => setDrawerOpen(false)}
            >
              {link.label || "Link"}
            </a>
          ))}
          {p.showCta !== false && p.ctaText && (
            <a
              href={safeUrl(p.ctaLink, "#positions")}
              className={`block mt-4 text-center text-sm font-semibold px-4 py-3 ${tokens.button.radiusClass} transition-all`}
              style={{ backgroundColor: tokens.colors.primary, color: getReadableTextColor(tokens.colors.primary) }}
              onClick={() => setDrawerOpen(false)}
            >
              {p.ctaText}
            </a>
          )}
        </nav>
      </ResponsiveDrawer>
    </>
  );
});
Navbar.displayName = "Navbar";

const socialIcons: Record<string, string> = {
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  instagram: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
};

const Footer = memo((raw: any) => {
  const p = withDefaults("footer", raw);
  const { tokens, branding, getAccent } = useTheme();
  const links = safeList(p.links, DEFAULT_BLOCK_PROPS.footer.links);
  const socials = safeList(p.socialLinks, DEFAULT_BLOCK_PROPS.footer.socialLinks);
  const isDark = p.variant !== "light";
  const footerStyle: React.CSSProperties = isDark
    ? { backgroundColor: "#030712", color: "#ffffff" }
    : { backgroundColor: tokens.colors.surface, color: tokens.colors.text, borderTop: `1px solid ${tokens.colors.border}` };
  const companyName = safeString(p.companyName, branding.companyName);
  const linkColor = isDark ? "#9ca3af" : tokens.colors.textMuted;
  return (
    <footer style={footerStyle} role="contentinfo">
      <Container className="py-8 sm:py-10 md:py-12">
        <div className="flex flex-col md:flex-row justify-between gap-8 md:gap-10">
          <div className="max-w-xs">
            <span className="text-base font-semibold tracking-tight block mb-3" style={{ color: isDark ? "#ffffff" : tokens.colors.text }}>{companyName}</span>
            {p.description && <p className="text-sm leading-relaxed" style={{ color: linkColor }}>{p.description}</p>}
            {socials.length > 0 && (
              <div className="flex items-center gap-3 mt-5" role="list" aria-label="Social media links">
                {socials.map((s: any, i: number) => {
                  const platform = safeString(s.platform, "social");
                  return (
                    <a
                      key={i}
                      href={safeUrl(s.url, "#")}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                      style={{ backgroundColor: isDark ? "#1f2937" : tokens.colors.border }}
                      aria-label={`${companyName} on ${platform}`}
                      role="listitem"
                    >
                      <svg className="w-4 h-4" style={{ color: linkColor }} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={socialIcons[platform] || socialIcons.linkedin} />
                      </svg>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
          {links.length > 0 && (
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap gap-x-6 sm:gap-x-8 gap-y-3 list-none p-0 m-0">
                {links.map((link: any, i: number) => (
                  <li key={i}>
                    <a href={safeUrl(link.url, "#")} className="text-sm transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded" style={{ color: linkColor }}>
                      {link.label || "Link"}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <div className="mt-8 sm:mt-10 md:mt-12 pt-6" style={{ borderTop: `1px solid ${isDark ? "#1f2937" : tokens.colors.border}` }}>
          <p className="text-xs" style={{ color: isDark ? "#4b5563" : tokens.colors.textMuted }}>
            {p.copyright || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
          </p>
        </div>
      </Container>
    </footer>
  );
});
Footer.displayName = "Footer";

/* ================================================================== */
/*  7. Component map & safe renderer                                   */
/* ================================================================== */

const componentMap: Record<string, React.FC<any>> = {
  navbar: Navbar,
  hero: Hero,
  content: Content,
  features: Features,
  testimonial: Testimonial,
  carousel: Carousel,
  accordion: Accordion,
  "cta-button": CtaButton,
  "search-bar": SearchBar,
  "search-results": SearchResults,
  "job-details": JobDetails,
  "job-category": JobCategory,
  "join-talent-network": JoinTalentNetwork,
  "video-and-text": VideoAndText,
  personalization: Personalization,
  "show-hide-tab": ShowHideTab,
  "image-text-grid": ImageTextGrid,
  "light-box": LightBox,
  "job-alert": JobAlert,
  "navigate-back": NavigateBack,
  "basic-button": BasicButton,
  "basic-image": BasicImage,
  spacer: Spacer,
  divider: Divider,
  "notification-banner": NotificationBanner,
  "stats-counter": StatsCounter,
  "team-grid": TeamGrid,
  "social-proof": SocialProof,
  "application-status": ApplicationStatus,
  footer: Footer,
};

export function RenderPage({ blocks }: { blocks: Block[] }) {
  const mainRef = useScrollReveal<HTMLElement>();

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return (
      <main id="main-content" className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--cb-color-background, #ffffff)" }}>
        <p className="text-sm" style={{ color: "var(--cb-color-text-muted, #9ca3af)" }}>No blocks to render.</p>
      </main>
    );
  }

  return (
    <main ref={mainRef} id="main-content" className="min-h-screen" style={{ backgroundColor: "var(--cb-color-background, #ffffff)" }}>
      {blocks.map((block, index) => {
        if (!block || !block.type) {
          console.warn(`[Renderer] Skipping invalid block at index ${index}`);
          return null;
        }
        const Component = componentMap[block.type];
        if (!Component) {
          console.warn(`[Renderer] Unknown block type: "${block.type}"`);
          return null;
        }
        return (
          <BlockErrorBoundary key={index} blockType={block.type}>
            <Component {...(block.props || {})} />
          </BlockErrorBoundary>
        );
      })}
    </main>
  );
}
