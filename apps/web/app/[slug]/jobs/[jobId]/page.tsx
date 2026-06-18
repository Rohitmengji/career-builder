import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobProvider } from "@/lib/jobs/provider";
import type { Job } from "@/lib/jobs/types";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { SkipLink } from "@/lib/design-system-components";
import { Container, Section, ButtonLink, Badge, CheckIcon, ArrowLeftIcon, ArrowRightIcon, MapPinIcon } from "@/components/ui";
import {
  type TenantConfig,
  DEFAULT_THEME,
  DEFAULT_BRANDING,
  mergeTenantConfig,
} from "@career-builder/tenant-config";

export const dynamic = "force-dynamic";

const EMPLOYMENT_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

function formatSalary(salary: Job["salary"]): string {
  if (!salary) return "";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: salary.currency || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  if (salary.min && salary.max) return `${fmt(salary.min)} – ${fmt(salary.max)}`;
  if (salary.min) return `From ${fmt(salary.min)}`;
  if (salary.max) return `Up to ${fmt(salary.max)}`;
  return "";
}

function formatPosted(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Resolve the admin API base URL (mirrors app/[slug]/page.tsx). */
function getAdminApiUrl(): string {
  const serverOnly = process.env.ADMIN_API_URL;
  if (serverOnly?.trim()) return serverOnly.trim().replace(/\/$/, "");
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (publicUrl?.trim()) return publicUrl.trim().replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3001";
}

async function loadTenantConfig(slug: string): Promise<TenantConfig | null> {
  const apiUrl = getAdminApiUrl();
  const fetchWithTimeout = (url: string, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { cache: "no-store", signal: controller.signal }).finally(() => clearTimeout(timer));
  };
  try {
    const res = await fetchWithTimeout(`${apiUrl}/api/tenants?id=${slug}`);
    const data = await res.json();
    if (data.tenant) return mergeTenantConfig(data.tenant);
  } catch { /* fall through */ }
  try {
    const res = await fetchWithTimeout(`${apiUrl}/api/tenants?id=default`);
    if (res.ok) {
      const data = await res.json();
      if (data.tenant) return mergeTenantConfig(data.tenant);
    }
  } catch { /* use defaults */ }
  return null;
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;

  // Read the real, tenant-scoped job from the database provider (no mock data).
  const tenantId = process.env.TENANT_ID || "default";
  const [{ job }, tenantConfig] = await Promise.all([
    getJobProvider().getById(jobId, tenantId),
    loadTenantConfig(slug),
  ]);
  if (!job) notFound();

  const theme = tenantConfig?.theme || DEFAULT_THEME;
  const branding = tenantConfig?.branding || DEFAULT_BRANDING;
  const salary = formatSalary(job.salary);
  const applyHref = `/${slug}/jobs/${jobId}/apply`;

  return (
    <ThemeProvider theme={theme} branding={branding}>
      <SkipLink />
      <main id="main-content" className="min-h-screen bg-white">
        {/* Back nav */}
        <nav aria-label="Breadcrumb" className="border-b border-gray-200/80">
          <Container className="py-4">
            <Link
              href={`/${slug}`}
              className="inline-flex items-center gap-1.5 min-h-11 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to all jobs
            </Link>
          </Container>
        </nav>

        {/* Job header */}
        <section className="bg-linear-to-b from-gray-50 to-white py-12 md:py-16 lg:py-20">
          <Container className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge tone="brand">{job.department}</Badge>
              <Badge tone="neutral">{EMPLOYMENT_LABELS[job.employmentType] || job.employmentType}</Badge>
              {job.isRemote && (
                <Badge tone="success">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  Remote
                </Badge>
              )}
              <span className="text-xs text-gray-500">Posted {formatPosted(job.postedAt)}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-semibold tracking-tight text-gray-900 text-balance mb-3">
              {job.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-gray-500" />
                {job.location}
              </span>
              {salary && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {salary}
                </span>
              )}
            </div>
            <div className="mt-8">
              <ButtonLink href={applyHref} size="lg">Apply for this role</ButtonLink>
            </div>
          </Container>
        </section>

        {/* Job details */}
        <section className="py-12 md:py-16 lg:py-20">
          <Container className="max-w-3xl">
            <div className="space-y-12">
              {/* Description */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">About the role</h2>
                <p className="max-w-[70ch] text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>
              </div>

              {/* Requirements */}
              {job.requirements.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">What you&apos;ll need</h2>
                  <ul className="space-y-3">
                    {job.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700">
                        <CheckIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nice to have */}
              {job.niceToHave.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Nice to have</h2>
                  <ul className="space-y-3">
                    {job.niceToHave.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700">
                        <svg className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12m6-6H6" /></svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Benefits */}
              {job.benefits.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Benefits &amp; perks</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {job.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                        <CheckIcon className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span className="text-sm text-gray-700">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Container>
        </section>

        {/* Apply CTA at bottom */}
        <Section muted className="border-t border-gray-200/80">
          <Container className="max-w-3xl text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-3">Interested in this role?</h2>
            <p className="text-gray-600 mb-6">We&apos;d love to hear from you. Apply now and our team will be in touch.</p>
            <ButtonLink href={applyHref} size="lg">
              Apply for this role
              <ArrowRightIcon className="h-4 w-4" />
            </ButtonLink>
          </Container>
        </Section>
      </main>
    </ThemeProvider>
  );
}
