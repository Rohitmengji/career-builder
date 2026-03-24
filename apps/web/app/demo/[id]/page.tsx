import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DemoPage {
  slug: string;
  title: string;
  description: string;
  sections: string[];
}

interface DemoJob {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
}

interface DemoData {
  demoId: string;
  companyName: string;
  industry: string;
  pages: DemoPage[];
  jobs: DemoJob[];
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/ai/demo-site?id=${id}`, { cache: "no-store" });
    if (!res.ok) return { title: "Demo Not Found — HireBase" };
    const data: DemoData = await res.json();
    return {
      title: `${data.companyName} Career Site Demo — HireBase`,
      description: `AI-generated career site demo for ${data.companyName} (${data.industry}).`,
    };
  } catch {
    return { title: "Demo — HireBase" };
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function DemoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let data: DemoData;
  try {
    const res = await fetch(`${baseUrl}/api/ai/demo-site?id=${id}`, { cache: "no-store" });
    if (!res.ok) notFound();
    data = await res.json();
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo banner */}
      <div className="bg-blue-600 text-white text-center py-3 px-4 text-sm font-medium">
        🚀 This is an AI-generated demo for <strong>{data.companyName}</strong>.{" "}
        <Link href="/landing" className="underline hover:text-blue-100">
          Build yours free →
        </Link>
      </div>

      {/* Hero */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            {data.companyName} — Join Our Team
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Explore open positions at {data.companyName} and help us shape the
            future of {data.industry}.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="font-semibold text-blue-600">{data.jobs.length} open roles</span>
            <span>·</span>
            <span>
              {[...new Set(data.jobs.map((j) => j.department))].length} teams
            </span>
            <span>·</span>
            <span>
              {[...new Set(data.jobs.map((j) => j.location))].length} locations
            </span>
          </div>
        </div>
      </section>

      {/* Pages preview */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Site Pages ({data.pages.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.pages.map((page) => (
            <div
              key={page.slug}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  /{page.slug}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {page.title}
              </h3>
              <p className="text-sm text-gray-500 mb-4">{page.description}</p>
              <ul className="space-y-1.5">
                {page.sections.map((s, i) => (
                  <li
                    key={i}
                    className="text-xs text-gray-400 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Jobs listing */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Open Positions ({data.jobs.length})
        </h2>
        <div className="space-y-3">
          {data.jobs.map((job, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">
                  {job.title}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {job.department} · {job.location} · {job.type}
                </p>
              </div>
              <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full w-fit">
                {job.type}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 text-center py-16 px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          Build a site like this in minutes
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          HireBase generates career sites with AI. Free to start.
        </p>
        <Link
          href="/landing"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-lg"
        >
          Start Free
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8 px-6 text-center">
        <p className="text-xs text-gray-400">
          Powered by{" "}
          <Link href="/landing" className="text-blue-600 hover:underline">
            HireBase
          </Link>{" "}
          — AI-powered career site platform · Generated{" "}
          {new Date(data.generatedAt).toLocaleDateString()}
        </p>
      </footer>
    </div>
  );
}
