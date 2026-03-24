/*
 * /jobs/[id] — Job detail page with full description, metadata, and apply modal.
 *
 * Server component for SEO + fast FCP. The apply modal is a client island.
 */

import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Job, JobDetailResponse } from "@/lib/jobs/types";
import ApplyModal from "@/app/jobs/[id]/ApplyModal";
import PersonalizedSidebar from "@/components/PersonalizedSidebar";

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getJob(id);
  if (!data || !data.job) return { title: "Job Not Found" };
  return {
    title: `${data.job.title} — ${data.job.department}`,
    description: data.job.description.slice(0, 160),
  };
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getJob(id);
  if (!data || !data.job) notFound();

  const job = data.job;
  const relatedJobs = data.relatedJobs;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/jobs"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            ← Back to all jobs
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <article className="flex-1 min-w-0">
            {/* Title + meta */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 mb-6">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge color="blue">{job.department}</Badge>
                <Badge color="green">{formatEmploymentType(job.employmentType)}</Badge>
                <Badge color="purple">{formatExperienceLevel(job.experienceLevel)}</Badge>
                {job.isRemote && <Badge color="emerald">Remote</Badge>}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
                <span className="flex items-center gap-1">
                  <LocationIcon /> {job.location}
                </span>
                {job.salary && (
                  <span className="flex items-center gap-1">
                    <SalaryIcon /> {formatSalary(job.salary)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ClockIcon /> Posted {formatDate(job.postedAt)}
                </span>
              </div>

              <p className="text-gray-700 leading-relaxed">{job.description}</p>
            </div>

            {/* Requirements */}
            {job.requirements && job.requirements.length > 0 && (
              <Section title="Requirements">
                <ul className="space-y-2">
                  {job.requirements.map((req, i) => (
                    <ListItem key={i}>{req}</ListItem>
                  ))}
                </ul>
              </Section>
            )}

            {/* Nice to have */}
            {job.niceToHave && job.niceToHave.length > 0 && (
              <Section title="Nice to Have">
                <ul className="space-y-2">
                  {job.niceToHave.map((item, i) => (
                    <ListItem key={i}>{item}</ListItem>
                  ))}
                </ul>
              </Section>
            )}

            {/* Benefits */}
            {job.benefits && job.benefits.length > 0 && (
              <Section title="Benefits & Perks">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {job.benefits.map((benefit, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg text-sm text-green-800"
                    >
                      <span className="text-green-500">✓</span>
                      {benefit}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Tags */}
            {job.tags && job.tags.length > 0 && (
              <Section title="Skills & Tags">
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Section>
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
      </main>
    </div>
  );
}

/* ================================================================== */
/*  Section wrapper                                                    */
/* ================================================================== */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-gray-700">
      <span className="text-blue-500 mt-1.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

/* ================================================================== */
/*  Badge                                                              */
/* ================================================================== */

const BADGE_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  purple: "bg-purple-50 text-purple-700",
  emerald: "bg-emerald-50 text-emerald-700",
  gray: "bg-gray-100 text-gray-700",
};

function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BADGE_COLORS[color] || BADGE_COLORS.gray}`}
    >
      {children}
    </span>
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
/*  Icons                                                              */
/* ================================================================== */

function LocationIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function SalaryIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
