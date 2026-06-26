/*
 * Demo Site Generator — internal sales-outreach tool.
 *
 * WHAT: A form that takes a company name + industry and calls the AI demo
 * endpoint to generate a throwaway career site (pages + jobs + preview URL),
 * then renders the result plus a copy-paste outreach template.
 *
 * WHY: Lets the sales team spin up a tailored demo site to show a prospect
 * "here's what your careers page could look like" in minutes, without seeding a
 * real tenant.
 *
 * HOW: Client component. Note the demo API lives on the WEB app (port 3000),
 * not this admin app (port 3001) — see handleGenerate, which rewrites the
 * origin's port before fetching /api/ai/demo-site. The generation itself is an
 * ai-client call on the web side; this page only renders the schema-validated
 * result. No auth guard here (it is an internal/sales surface) and no tenant
 * scoping — demos are ephemeral and not persisted as tenant data.
 */
"use client";

import React, { useState } from "react";
import {
  Button,
  Field,
  Card,
  Badge,
  Alert,
  Spinner,
  CheckIcon,
} from "@/components/ui";

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "fintech", label: "Fintech" },
  { value: "healthcare", label: "Healthcare" },
  { value: "ecommerce", label: "E-Commerce" },
  { value: "saas", label: "SaaS" },
  { value: "consulting", label: "Consulting" },
  { value: "education", label: "Education" },
  { value: "manufacturing", label: "Manufacturing" },
];

const OUTREACH_TEMPLATE = `Hey — I built a tool that generates a full career site + job system using AI in minutes.

Saw you're hiring — thought this might save you time.

Happy to set it up for you free.`;

interface DemoResult {
  demoId: string;
  companyName: string;
  industry: string;
  pages: { slug: string; title: string; description: string; sections: string[] }[];
  jobs: { title: string; department: string; location: string; type: string; description: string }[];
  previewUrl: string;
  generatedAt: string;
}

/* Shared select control matching the Field primitive look. */
function SelectControl({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 transition"
      >
        {children}
      </select>
    </div>
  );
}

function CopyIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export default function DemoGeneratorPage() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("technology");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!companyName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // The demo API is on the web app (port 3000)
      const baseUrl = window.location.origin.replace(":3001", ":3000");
      const res = await fetch(`${baseUrl}/api/ai/demo-site`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim(), industry }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data: DemoResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Demo Site Generator
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Generate demo career sites for sales outreach.
          </p>
        </header>

        {/* Input form */}
        <Card className="mb-8">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
            <SelectControl label="Industry" value={industry} onChange={setIndustry}>
              {INDUSTRIES.map((ind) => (
                <option key={ind.value} value={ind.value}>{ind.label}</option>
              ))}
            </SelectControl>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading || !companyName.trim()}
            loading={loading}
          >
            {loading ? "Generating…" : "Generate Demo Site"}
          </Button>
          {error && (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
        </Card>

        {/* Loading skeleton hint */}
        {loading && !result && (
          <div className="flex items-center gap-2 text-sm text-gray-600" role="status" aria-live="polite">
            <Spinner className="h-4 w-4" />
            Generating demo site…
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Preview link */}
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Generated Demo</h2>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono text-gray-600">
                  {window.location.origin.replace(":3001", ":3000")}{result.previewUrl}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard(
                    `${window.location.origin.replace(":3001", ":3000")}${result.previewUrl}`,
                    "url"
                  )}
                >
                  {copied === "url" ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                  {copied === "url" ? "Copied" : "Copy URL"}
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Generated for: {result.companyName}{" "}
                <Badge tone="brand">{result.industry}</Badge>
              </p>
            </Card>

            {/* Pages */}
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Pages ({result.pages.length})</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {result.pages.map((page) => (
                  <div key={page.slug} className="rounded-xl border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">{page.title}</h3>
                    <p className="mb-3 mt-1 text-xs text-gray-600">{page.description}</p>
                    <ul className="space-y-1">
                      {page.sections.map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>

            {/* Jobs */}
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Jobs ({result.jobs.length})</h2>
              <div className="space-y-2">
                {result.jobs.map((job, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{job.title}</p>
                      <p className="text-xs text-gray-600">
                        {job.department} <span aria-hidden="true">·</span> {job.location} <span aria-hidden="true">·</span> {job.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Outreach template */}
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Outreach Template</h2>
              <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                {OUTREACH_TEMPLATE}
              </pre>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard(OUTREACH_TEMPLATE, "outreach")}
                >
                  {copied === "outreach" ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                  {copied === "outreach" ? "Copied" : "Copy Template"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
