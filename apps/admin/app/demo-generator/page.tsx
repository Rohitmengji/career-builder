"use client";

import React, { useState } from "react";

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Demo Site Generator</h1>
          <p className="text-gray-500 text-sm mt-1">Generate demo career sites for sales outreach</p>
        </div>

        {/* Input form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>{ind.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !companyName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Generate Demo Site"}
          </button>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Preview link */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Generated Demo</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-mono text-gray-600 border border-gray-200">
                  {window.location.origin.replace(":3001", ":3000")}{result.previewUrl}
                </div>
                <button
                  onClick={() => copyToClipboard(
                    `${window.location.origin.replace(":3001", ":3000")}${result.previewUrl}`,
                    "url"
                  )}
                  className="bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                >
                  {copied === "url" ? "✓ Copied" : "Copy URL"}
                </button>
              </div>
              <p className="text-xs text-gray-400">Generated for: {result.companyName} ({result.industry})</p>
            </div>

            {/* Pages */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pages ({result.pages.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.pages.map((page) => (
                  <div key={page.slug} className="border border-gray-100 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 text-sm">{page.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-3">{page.description}</p>
                    <ul className="space-y-1">
                      {page.sections.map((s, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                          <span className="w-1 h-1 bg-blue-400 rounded-full shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Jobs */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Jobs ({result.jobs.length})</h2>
              <div className="space-y-2">
                {result.jobs.map((job, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{job.title}</p>
                      <p className="text-xs text-gray-500">{job.department} · {job.location} · {job.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Outreach template */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Outreach Template</h2>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {OUTREACH_TEMPLATE}
              </pre>
              <button
                onClick={() => copyToClipboard(OUTREACH_TEMPLATE, "outreach")}
                className="mt-3 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                {copied === "outreach" ? "✓ Copied" : "Copy Template"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
