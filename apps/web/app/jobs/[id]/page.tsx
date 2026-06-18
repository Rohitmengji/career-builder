/*
 * /jobs/[id] — Job detail page with full description, metadata, and apply modal.
 *
 * Server component for SEO + fast FCP. The apply modal is a client island.
 */

import React from "react";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Job, JobDetailResponse } from "@/lib/jobs/types";
import ApplyModal from "@/app/jobs/[id]/ApplyModal";
import PersonalizedSidebar from "@/components/PersonalizedSidebar";
import JobViewTracker from "@/app/jobs/[id]/JobViewTracker";
import SiteHeader from "@/components/SiteHeader";
import { fetchTenantConfig } from "@/lib/tenant";
import { getSiteUrl } from "@/lib/env";
import { Container, Card, Badge, CheckIcon, ArrowLeftIcon, MapPinIcon } from "@/components/ui";

/* ================================================================== */
/*  Data fetching (server-side)                                        */
/* ================================================================== */

async function getJob(id: string): Promise<JobDetailResponse | null> {
  // Use absolute URL for server-side fetch (need to know the host)
  // In production this would use an internal URL; for dev we use relative
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/jobs/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* ================================================================== */
/*  Metadata                                                           */
/* ================================================================== */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [data, config] = await Promise.all([getJob(id), fetchTenantConfig()]);
  if (!data?.job) return { title: "Job Not Found" };

  const job = data.job;
  const siteUrl = getSiteUrl();
  const companyName = config.branding?.companyName || "Our Company";
  const logoUrl = config.branding?.logoUrl;

  const title = `${job.title} at ${companyName}`;
  const description = `${job.title} — ${job.department} · ${job.location}. ${job.description.slice(0, 150)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/jobs/${id}`,
      type: "website",
      ...(logoUrl ? { images: [{ url: logoUrl, alt: companyName }] } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `${siteUrl}/jobs/${id}`,
    },
  };
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, config] = await Promise.all([getJob(id), fetchTenantConfig()]);
  if (!data || !data.job) notFound();

  const job = data.job;
  const relatedJobs = data.relatedJobs;
  const siteUrl = getSiteUrl();
  const companyName = config.branding?.companyName || "Our Company";
  const logoUrl = config.branding?.logoUrl;

  /* ── JSON-LD: Schema.org JobPosting ──────────────────────────── */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    identifier: {
      "@type": "PropertyValue",
      name: companyName,
      value: job.id,
    },
    datePosted: job.postedAt,
    ...(job.closesAt ? { validThrough: job.closesAt } : {}),
    employmentType: job.employmentType?.toUpperCase().replace("-", "_"),
    hiringOrganization: {
      "@type": "Organization",
      name: companyName,
      ...(logoUrl ? { logo: logoUrl } : {}),
      url: siteUrl,
    },
    jobLocation: job.isRemote
      ? { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "US" } }
      : { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location } },
    ...(job.isRemote ? { jobLocationType: "TELECOMMUTE" } : {}),
    url: `${siteUrl}/jobs/${job.id}`,
    ...(job.salary?.min || job.salary?.max
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.salary.currency || "USD",
            value: {
              "@type": "QuantitativeValue",
              ...(job.salary.min ? { minValue: job.salary.min } : {}),
              ...(job.salary.max ? { maxValue: job.salary.max } : {}),
              unitText: (job.salary.period || "YEAR").toUpperCase(),
            },
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* JSON-LD structured data for Google Jobs */}
      <Script
        id={`job-jsonld-${job.id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Client-side analytics tracker (renders null) */}
      <JobViewTracker jobId={job.id} />

      {/* Shared site navigation */}
      <SiteHeader brand={companyName} />

      <Container className="py-8 md:py-12 lg:py-14">
        {/* Back link */}
        <Link
          href="/jobs"
          className="mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to all jobs
        </Link>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <article className="min-w-0 flex-1 space-y-6">
            {/* Title + meta */}
            <Card className="sm:p-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge tone="brand">{job.department}</Badge>
                <Badge tone="neutral">{formatEmploymentType(job.employmentType)}</Badge>
                <Badge tone="info">{formatExperienceLevel(job.experienceLevel)}</Badge>
                {job.isRemote && (
                  <Badge tone="success">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    Remote
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl text-balance">
                {job.title}
              </h1>

              <div className="mt-4 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <LocationIcon /> {job.location}
                </span>
                {job.salary && (
                  <span className="flex items-center gap-1.5">
                    <SalaryIcon /> {formatSalary(job.salary)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <ClockIcon /> Posted {formatDate(job.postedAt)}
                </span>
              </div>

              <p className="max-w-[70ch] whitespace-pre-line text-base leading-relaxed text-gray-700">
                {job.description}
              </p>
            </Card>

            {/* Requirements */}
            {job.requirements && job.requirements.length > 0 && (
              <ContentSection title="Requirements">
                <ul className="space-y-2.5">
                  {job.requirements.map((req, i) => (
                    <ListItem key={i}>{req}</ListItem>
                  ))}
                </ul>
              </ContentSection>
            )}

            {/* Nice to have */}
            {job.niceToHave && job.niceToHave.length > 0 && (
              <ContentSection title="Nice to Have">
                <ul className="space-y-2.5">
                  {job.niceToHave.map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </ContentSection>
            )}

            {/* Benefits */}
            {job.benefits && job.benefits.length > 0 && (
              <ContentSection title="Benefits & Perks">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {job.benefits.map((benefit, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800"
                    >
                      <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </ContentSection>
            )}

            {/* Tags */}
            {job.tags && job.tags.length > 0 && (
              <ContentSection title="Skills & Tags">
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </ContentSection>
            )}
          </article>

          {/* Sidebar — client island for personalization + sticky CTA */}
          <PersonalizedSidebar
            jobId={job.id}
            jobTitle={job.title}
            jobDepartment={job.department}
            jobLocation={job.location}
            jobTags={job.tags || []}
            serverRelatedJobs={relatedJobs}
            applyModal={<ApplyModal jobId={job.id} jobTitle={job.title} />}
          />
        </div>
      </Container>
    </div>
  );
}

/* ================================================================== */
/*  Section wrapper                                                    */
/* ================================================================== */

function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="sm:p-8">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </Card>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-gray-700">
      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
      <span>{children}</span>
    </li>
  );
}

/* ================================================================== */
/*  Formatting helpers                                                 */
/* ================================================================== */

function formatEmploymentType(t: string): string {
  const map: Record<string, string> = {
    "full-time": "Full-time",
    "part-time": "Part-time",
    contract: "Contract",
    internship: "Internship",
    temporary: "Temporary",
  };
  return map[t] || t;
}

function formatExperienceLevel(l: string): string {
  const map: Record<string, string> = {
    entry: "Entry level",
    mid: "Mid level",
    senior: "Senior",
    lead: "Lead",
    executive: "Executive",
  };
  return map[l] || l;
}

function formatSalary(salary: Job["salary"]): string {
  if (!salary) return "";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: salary.currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (salary.min && salary.max) return `${fmt(salary.min)} – ${fmt(salary.max)}`;
  if (salary.min) return `From ${fmt(salary.min)}`;
  if (salary.max) return `Up to ${fmt(salary.max)}`;
  return "";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ================================================================== */
/*  Icons (decorative — aria-hidden)                                   */
/* ================================================================== */

function LocationIcon() {
  return (
    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function SalaryIcon() {
  return (
    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
