import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Badge,
  ButtonLink,
  Card,
  Container,
  EmptyState,
  ArrowRightIcon,
  MapPinIcon,
} from "@/components/ui";

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

  const teams = [...new Set(data.jobs.map((j) => j.department))].length;
  const locations = [...new Set(data.jobs.map((j) => j.location))].length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo banner */}
      <div className="bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white">
        <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Badge tone="neutral" className="bg-white/20 text-white">
            DEMO
          </Badge>
          <span>
            This is an AI-generated demo for{" "}
            <strong className="font-semibold">{data.companyName}</strong>.
          </span>
          <Link
            href="/landing"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-sm"
          >
            Build yours free
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </span>
      </div>

      {/* Hero */}
      <section className="border-b border-gray-200 bg-white">
        <Container className="py-16 text-center md:py-20 lg:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-gray-900 text-balance sm:text-5xl">
            {data.companyName} — Join Our Team
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-gray-600 text-balance">
            Explore open positions at {data.companyName} and help us shape the
            future of {data.industry}.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600">
            <span className="font-semibold text-blue-600">
              {data.jobs.length} open roles
            </span>
            <span aria-hidden="true" className="text-gray-300">
              ·
            </span>
            <span>
              {teams} {teams === 1 ? "team" : "teams"}
            </span>
            <span aria-hidden="true" className="text-gray-300">
              ·
            </span>
            <span>
              {locations} {locations === 1 ? "location" : "locations"}
            </span>
          </div>
        </Container>
      </section>

      {/* Pages preview */}
      <section>
        <Container className="py-16">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900">
            Site Pages ({data.pages.length})
          </h2>
          {data.pages.length === 0 ? (
            <Card>
              <EmptyState
                title="No pages generated"
                body="This demo doesn't include any site pages yet."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {data.pages.map((page) => (
                <Card key={page.slug} as="article">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">
                      /{page.slug}
                    </span>
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">
                    {page.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-gray-600">
                    {page.description}
                  </p>
                  <ul className="space-y-1.5">
                    {page.sections.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-xs text-gray-600"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                          aria-hidden="true"
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Jobs listing */}
      <section>
        <Container className="pb-16">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight text-gray-900">
            Open Positions ({data.jobs.length})
          </h2>
          {data.jobs.length === 0 ? (
            <Card>
              <EmptyState
                icon={<MapPinIcon className="h-6 w-6" />}
                title="No open positions"
                body={`There are no roles listed for ${data.companyName} right now.`}
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {data.jobs.map((job, i) => (
                <li key={i}>
                  <Card
                    as="article"
                    className="flex min-h-[44px] flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-gray-900">
                        {job.title}
                      </h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-gray-600">
                        <span>{job.department}</span>
                        <span aria-hidden="true" className="text-gray-300">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="h-3.5 w-3.5 text-gray-500" />
                          {job.location}
                        </span>
                      </p>
                    </div>
                    <Badge tone="brand" className="w-fit">
                      {job.type}
                    </Badge>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      {/* CTA */}
      <section className="bg-gray-900">
        <Container className="py-16 text-center md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white text-balance sm:text-3xl">
            Build a site like this in minutes
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-gray-300">
            HireBase generates career sites with AI. Free to start.
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/landing" size="lg">
              Start Free
              <ArrowRightIcon className="h-4 w-4" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-8 text-center">
        <p className="text-xs text-gray-600">
          Powered by{" "}
          <Link
            href="/landing"
            className="font-medium text-blue-600 hover:underline"
          >
            HireBase
          </Link>{" "}
          — AI-powered career site platform{" "}
          <span aria-hidden="true">·</span> Generated{" "}
          {new Date(data.generatedAt).toLocaleDateString()}
        </p>
      </footer>
    </div>
  );
}
