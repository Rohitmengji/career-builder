import Link from "next/link";
import { mergeTenantConfig } from "@career-builder/tenant-config";
import {
  Container,
  Section,
  Card,
  ButtonLink,
  Badge,
  ArrowRightIcon,
} from "@/components/ui";
import { SkipLink } from "@/lib/design-system-components";

const VALUE_PROPS = [
  {
    title: "Growth & Impact",
    desc: "Work on problems that matter. Ship products used by thousands. Grow faster than you thought possible.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
  },
  {
    title: "Inclusive Culture",
    desc: "A diverse team where every voice is heard. We hire for talent and potential, not just credentials.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    ),
  },
  {
    title: "Work-Life Balance",
    desc: "Flexible schedules, generous PTO, and a genuine commitment to your wellbeing — not just buzzwords.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
];

function getAdminApiUrl(): string {
  const serverOnly = process.env.ADMIN_API_URL;
  if (serverOnly?.trim()) return serverOnly.trim().replace(/\/$/, "");

  const publicUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (publicUrl?.trim()) return publicUrl.trim().replace(/\/$/, "");

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3001";
}

interface JobSummary {
  department: string;
  count: number;
}

export default async function Home() {
  const apiUrl = getAdminApiUrl();

  // Fetch tenant branding for dynamic company name
  let companyName = "Your Company";
  let pages: string[] = [];
  let jobSummary: JobSummary[] = [];
  let totalJobs = 0;

  try {
    const res = await fetch(`${apiUrl}/api/tenants?id=default`, { cache: "no-store" });
    const data = await res.json();
    if (data.tenant) {
      const config = mergeTenantConfig(data.tenant);
      companyName = config.branding?.companyName || companyName;
    }
  } catch {
    // Admin API may not be running
  }

  // Fetch available pages to build dynamic navigation
  try {
    const res = await fetch(`${apiUrl}/api/pages`, { cache: "no-store" });
    const data = await res.json();
    pages = data.pages || [];
  } catch {
    // Admin API may not be running
  }

  // Fetch job counts by department for the stats section
  try {
    const res = await fetch(`${apiUrl}/api/jobs?tenantId=default&limit=100`, { cache: "no-store" });
    const data = await res.json();
    const jobs = data.jobs || [];
    totalJobs = jobs.length;
    const deptMap = new Map<string, number>();
    for (const job of jobs) {
      const dept = job.department || "General";
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    }
    jobSummary = Array.from(deptMap.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  } catch {
    // Jobs API may not be running
  }

  const hasAbout = pages.includes("about");
  const hasCulture = pages.includes("culture");
  const hasBenefits = pages.includes("benefits");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />

      {/* ─── Nav ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <Container className="h-16 flex items-center justify-between">
          <span className="text-base font-semibold text-gray-900 tracking-tight">
            {companyName}
          </span>
          <nav className="flex items-center gap-6 sm:gap-8 text-sm" aria-label="Primary">
            {hasAbout && (
              <Link href="/about" className="text-gray-700 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">About</Link>
            )}
            {hasCulture && (
              <Link href="/culture" className="text-gray-700 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Culture</Link>
            )}
            {hasBenefits && (
              <Link href="/benefits" className="text-gray-700 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Benefits</Link>
            )}
            <Link href="/jobs" className="text-gray-700 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              Jobs
            </Link>
            <ButtonLink href="/careers" variant="secondary" size="sm" className="bg-gray-900 text-white hover:bg-gray-800">
              Careers
            </ButtonLink>
          </nav>
        </Container>
      </header>

      <main id="main-content" className="flex-1">
        {/* ─── Hero ──────────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 md:pb-24 xl:pt-44 xl:pb-28 overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-linear-to-br from-blue-50/80 via-white to-indigo-50/60" aria-hidden="true" />
          <div className="absolute top-0 right-0 w-125 h-125 bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-100 h-100 bg-indigo-100/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" aria-hidden="true" />

          <Container className="relative">
            <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
              <Badge tone="brand" className="px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" aria-hidden="true" />
                {totalJobs > 0
                  ? `${totalJobs} open position${totalJobs !== 1 ? "s" : ""} across ${jobSummary.length} team${jobSummary.length !== 1 ? "s" : ""}`
                  : "We're hiring across all teams"}
              </Badge>
              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-bold text-gray-900 tracking-tight leading-[1.08] text-balance">
                Build what
                <span className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> matters</span>.
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl text-balance">
                Join {companyName} and help shape the future.
                We&apos;re looking for talented people who want to do their best work.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
                <ButtonLink href="/careers" size="lg" className="bg-gray-900 text-white hover:bg-gray-800">
                  View Open Positions
                  <ArrowRightIcon className="h-4 w-4" />
                </ButtonLink>
                {hasCulture ? (
                  <ButtonLink href="/culture" variant="secondary" size="lg" className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                    Our Culture
                  </ButtonLink>
                ) : hasAbout ? (
                  <ButtonLink href="/about" variant="secondary" size="lg" className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                    About Us
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          </Container>
        </section>

        {/* ─── Stats ─────────────────────────────────────────────── */}
        {totalJobs > 0 && (
          <section className="border-y border-gray-100 bg-gray-50/50">
            <Container className="py-12">
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center max-w-5xl mx-auto">
                {[
                  { value: String(totalJobs), label: "Open Roles" },
                  { value: String(jobSummary.length), label: "Teams Hiring" },
                  { value: "100%", label: "Remote Friendly" },
                  { value: "4.8★", label: "Employee Rating" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dd className="text-3xl font-bold text-gray-900">{stat.value}</dd>
                    <dt className="text-sm text-gray-600 mt-1">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            </Container>
          </section>
        )}

        {/* ─── Departments ───────────────────────────────────────── */}
        {jobSummary.length > 0 && (
          <Section>
            <Container className="max-w-5xl">
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight text-balance">Explore teams</h2>
                <p className="text-gray-600 mt-3 max-w-md mx-auto text-balance">
                  Find the right team for you. We&apos;re growing across every department.
                </p>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobSummary.map(({ department, count }) => (
                  <li key={department}>
                    <Link
                      href={`/jobs?department=${encodeURIComponent(department)}`}
                      data-card="interactive"
                      className="group flex items-center justify-between gap-3 p-5 rounded-2xl border border-gray-200/80 bg-white shadow-xs transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <span>
                        <span className="block font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {department}
                        </span>
                        <span className="block text-sm text-gray-600 mt-0.5">
                          {count} open role{count !== 1 ? "s" : ""}
                        </span>
                      </span>
                      <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
          </Section>
        )}

        {/* ─── Value Props ───────────────────────────────────────── */}
        <Section muted>
          <Container className="max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight text-balance">
                Why {companyName}?
              </h2>
              <p className="text-gray-600 mt-3 max-w-md mx-auto text-balance">
                More than a job — a place to grow, learn, and make an impact.
              </p>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {VALUE_PROPS.map((item) => (
                <Card as="li" key={item.title} className="p-8">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden="true">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      {item.icon}
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </ul>
          </Container>
        </Section>

        {/* ─── CTA ───────────────────────────────────────────────── */}
        <Section>
          <Container className="max-w-3xl text-center">
            <h2 className="text-2xl sm:text-3xl xl:text-4xl font-semibold text-gray-900 tracking-tight text-balance">
              Ready to build something great?
            </h2>
            <p className="text-gray-600 mt-4 max-w-lg mx-auto text-lg text-balance">
              Browse our open roles and find your next chapter.
              We can&apos;t wait to hear from you.
            </p>
            <div className="mt-8">
              <ButtonLink href="/careers" size="lg">
                See All Open Positions
                <ArrowRightIcon className="h-4 w-4" />
              </ButtonLink>
            </div>
          </Container>
        </Section>
      </main>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-gray-50/30">
        <Container className="py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm font-semibold text-gray-900">{companyName}</div>
            <nav className="flex items-center gap-2 text-sm" aria-label="Footer">
              <Link href="/careers" className="px-2 py-2 text-gray-600 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Careers</Link>
              <Link href="/jobs" className="px-2 py-2 text-gray-600 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Jobs</Link>
              {hasAbout && <Link href="/about" className="px-2 py-2 text-gray-600 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">About</Link>}
              {hasCulture && <Link href="/culture" className="px-2 py-2 text-gray-600 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Culture</Link>}
              {hasBenefits && <Link href="/benefits" className="px-2 py-2 text-gray-600 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Benefits</Link>}
            </nav>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}