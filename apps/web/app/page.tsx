import Link from "next/link";
import {
  type TenantConfig,
  DEFAULT_BRANDING,
  mergeTenantConfig,
} from "@career-builder/tenant-config";
import SiteHeader from "@/components/SiteHeader";

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
      {/* ─── Nav ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-base font-semibold text-gray-900 tracking-tight">
            {companyName}
          </span>
          <nav className="flex items-center gap-8 text-sm">
            {hasAbout && (
              <Link href="/about" className="text-gray-500 hover:text-gray-900 transition-colors">About</Link>
            )}
            {hasCulture && (
              <Link href="/culture" className="text-gray-500 hover:text-gray-900 transition-colors">Culture</Link>
            )}
            {hasBenefits && (
              <Link href="/benefits" className="text-gray-500 hover:text-gray-900 transition-colors">Benefits</Link>
            )}
            <Link
              href="/jobs"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Jobs
            </Link>
            <Link
              href="/careers"
              className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Careers
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-50/80 via-white to-indigo-50/60" />
        <div className="absolute top-0 right-0 w-125 h-125 bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-100 h-100 bg-indigo-100/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-medium border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {totalJobs > 0
              ? `${totalJobs} open position${totalJobs !== 1 ? "s" : ""} across ${jobSummary.length} team${jobSummary.length !== 1 ? "s" : ""}`
              : "We're hiring across all teams"}
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-gray-900 tracking-tight leading-[1.08]">
            Build what
            <span className="bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> matters</span>.
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl">
            Join {companyName} and help shape the future.
            We&apos;re looking for talented people who want to do their best work.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
            <Link
              href="/careers"
              className="bg-gray-900 hover:bg-gray-800 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-gray-900/10 text-sm hover:shadow-xl hover:-translate-y-0.5"
            >
              View Open Positions →
            </Link>
            {hasCulture ? (
              <Link
                href="/culture"
                className="border border-gray-200 text-gray-700 font-medium px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-all text-sm"
              >
                Our Culture
              </Link>
            ) : hasAbout ? (
              <Link
                href="/about"
                className="border border-gray-200 text-gray-700 font-medium px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-all text-sm"
              >
                About Us
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── Stats ───────────────────────────────────────────────── */}
      {totalJobs > 0 && (
        <section className="border-y border-gray-100 bg-gray-50/50">
          <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-gray-900">{totalJobs}</p>
              <p className="text-sm text-gray-500 mt-1">Open Roles</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{jobSummary.length}</p>
              <p className="text-sm text-gray-500 mt-1">Teams Hiring</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">100%</p>
              <p className="text-sm text-gray-500 mt-1">Remote Friendly</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">4.8★</p>
              <p className="text-sm text-gray-500 mt-1">Employee Rating</p>
            </div>
          </div>
        </section>
      )}

      {/* ─── Departments ─────────────────────────────────────────── */}
      {jobSummary.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Explore Teams</h2>
              <p className="text-gray-500 mt-3 max-w-md mx-auto">
                Find the right team for you. We&apos;re growing across every department.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobSummary.map(({ department, count }) => (
                <Link
                  key={department}
                  href={`/jobs?department=${encodeURIComponent(department)}`}
                  className="group flex items-center justify-between p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all bg-white"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {department}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {count} open role{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all text-lg">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Value Props ─────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Why {companyName}?
            </h2>
            <p className="text-gray-500 mt-3 max-w-md mx-auto">
              More than a job — a place to grow, learn, and make an impact.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "🚀",
                title: "Growth & Impact",
                desc: "Work on problems that matter. Ship products used by thousands. Grow faster than you thought possible.",
              },
              {
                icon: "🤝",
                title: "Inclusive Culture",
                desc: "A diverse team where every voice is heard. We hire for talent and potential, not just credentials.",
              },
              {
                icon: "⚖️",
                title: "Work-Life Balance",
                desc: "Flexible schedules, generous PTO, and a genuine commitment to your wellbeing — not just buzzwords.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Ready to build something great?
          </h2>
          <p className="text-gray-500 mt-4 max-w-lg mx-auto text-lg">
            Browse our open roles and find your next chapter.
            We can&apos;t wait to hear from you.
          </p>
          <Link
            href="/careers"
            className="inline-block mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-xl hover:-translate-y-0.5 text-sm"
          >
            See All Open Positions →
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-gray-50/30">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm font-semibold text-gray-900">{companyName}</div>
            <nav className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/careers" className="hover:text-gray-900 transition-colors">Careers</Link>
              <Link href="/jobs" className="hover:text-gray-900 transition-colors">Jobs</Link>
              {hasAbout && <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>}
              {hasCulture && <Link href="/culture" className="hover:text-gray-900 transition-colors">Culture</Link>}
              {hasBenefits && <Link href="/benefits" className="hover:text-gray-900 transition-colors">Benefits</Link>}
            </nav>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}