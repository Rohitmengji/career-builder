/**
 * SiteGenerator — The generation form + orchestration modal.
 *
 * This is the entry point: user fills in company details, clicks Generate,
 * then gets routed to SitePreview for review before applying.
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  SiteGenerationInput,
  GeneratedSite,
} from "@/lib/ai/site-generator/siteSchema";
import type {
  AiTone,
  AiIndustry,
  AiCompanyType,
  AiAudience,
} from "@/lib/ai/types";
import SitePreview from "./SitePreview";
import { csrfHeaders } from "@/lib/csrf";
import {
  buildSiteContext,
  saveSiteContextLocal,
  saveSiteContextToServer,
  loadSiteContext,
} from "@/lib/ai/context/siteContext";

/* ================================================================== */
/*  Option lists                                                       */
/* ================================================================== */

const TONES: { value: AiTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "bold", label: "Bold & Energetic" },
  { value: "minimal", label: "Clean & Minimal" },
  { value: "hiring-focused", label: "Hiring-Focused" },
];

const INDUSTRIES: { value: AiIndustry; label: string }[] = [
  { value: "technology", label: "Technology" },
  { value: "fintech", label: "Fintech" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "ecommerce", label: "E-Commerce" },
  { value: "saas", label: "SaaS" },
  { value: "consulting", label: "Consulting" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "media", label: "Media & Entertainment" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
];

const COMPANY_TYPES: { value: AiCompanyType; label: string }[] = [
  { value: "startup", label: "Startup (1–50)" },
  { value: "scaleup", label: "Scale-up (50–500)" },
  { value: "enterprise", label: "Enterprise (500+)" },
  { value: "agency", label: "Agency" },
  { value: "nonprofit", label: "Nonprofit" },
];

const AUDIENCES: { value: AiAudience; label: string }[] = [
  { value: "general", label: "All Candidates" },
  { value: "engineers", label: "Engineers" },
  { value: "designers", label: "Designers" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "executives", label: "Executives" },
];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

interface SiteGeneratorProps {
  /** Callback when user applies the generated site */
  onSiteApplied: (site: GeneratedSite) => void;
  /** Close the generator modal */
  onClose: () => void;
}

export default function SiteGenerator({ onSiteApplied, onClose }: SiteGeneratorProps) {
  // Form state
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<AiIndustry>("technology");
  const [companyType, setCompanyType] = useState<AiCompanyType>("startup");
  const [tone, setTone] = useState<AiTone>("professional");
  const [audience, setAudience] = useState<AiAudience>("general");
  const [hiringGoals, setHiringGoals] = useState("");
  const [prompt, setPrompt] = useState("");

  // Generation state
  const [phase, setPhase] = useState<"form" | "generating" | "preview">("form");
  const [generatedSite, setGeneratedSite] = useState<GeneratedSite | null>(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [progress, setProgress] = useState({ completed: 0, total: 0, currentPage: "" });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Pre-populate from saved context (if user previously generated a site)
  useEffect(() => {
    const ctx = loadSiteContext();
    if (ctx?.companyName) {
      setCompanyName(ctx.companyName);
      if (ctx.industry) setIndustry(ctx.industry as AiIndustry);
      if (ctx.companyType) setCompanyType(ctx.companyType as AiCompanyType);
      if (ctx.tone) setTone(ctx.tone as AiTone);
      if (ctx.audience) setAudience(ctx.audience as AiAudience);
      if (ctx.hiringGoals) setHiringGoals(ctx.hiringGoals);
      if (ctx.originalPrompt) setPrompt(ctx.originalPrompt);
    }
  }, []);

  // Escape key to close (unless generating)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "form") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, onClose]);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }

    setPhase("generating");
    setError(null);
    setProgress({ completed: 0, total: 6, currentPage: "Planning…" });

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const input: SiteGenerationInput = {
      companyName: companyName.trim(),
      industry,
      companyType,
      tone,
      audience,
      hiringGoals: hiringGoals.trim() || undefined,
      prompt: prompt.trim() || undefined,
    };

    try {
      const res = await fetch("/api/ai/site", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(input),
        signal: abortRef.current.signal,
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Site generation failed");
      }

      setGeneratedSite(data.site);
      setCreditsUsed(data.creditsUsed || 5);

      // Save AI context for future regeneration consistency
      const pageSlugs = (data.site as GeneratedSite).pages.map((p: any) => p.slug);
      const ctx = buildSiteContext(input, "", pageSlugs);
      saveSiteContextLocal(ctx);
      saveSiteContextToServer(ctx).catch(() => {}); // fire-and-forget

      setPhase("preview");
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Generation failed. Please try again.");
      setPhase("form");
    }
  }, [companyName, industry, companyType, tone, audience, hiringGoals, prompt]);

  // Handle apply from preview
  const handleApply = useCallback((site: GeneratedSite) => {
    onSiteApplied(site);
  }, [onSiteApplied]);

  // Handle cancel from preview — go back to form
  const handlePreviewCancel = useCallback(() => {
    setPhase("form");
    setGeneratedSite(null);
  }, []);

  const input: SiteGenerationInput = {
    companyName: companyName.trim(),
    industry,
    companyType,
    tone,
    audience,
    hiringGoals: hiringGoals.trim() || undefined,
    prompt: prompt.trim() || undefined,
  };

  // ── Preview phase ─────────────────────────────────────────────
  if (phase === "preview" && generatedSite) {
    return (
      <SitePreview
        site={generatedSite}
        input={input}
        onApply={handleApply}
        onCancel={handlePreviewCancel}
        creditsUsed={creditsUsed}
      />
    );
  }

  // ── Form / Generating phase ───────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <h1 className="text-xl font-bold">✨ Generate Full Career Site</h1>
          <p className="text-blue-100 text-sm mt-1">
            AI will create a complete multi-page career website for your company in ~60 seconds.
          </p>
        </div>

        {/* Generating state */}
        {phase === "generating" ? (
          <div className="p-8 text-center">
            <div className="inline-block w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Generating Your Career Site</h2>
            <p className="text-gray-500 text-sm mb-4">
              Creating {progress.total} pages with AI-powered content…
            </p>
            <p className="text-xs text-gray-400">
              {progress.currentPage || "Planning site structure…"}
            </p>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i < progress.completed ? "bg-blue-500" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => {
                abortRef.current?.abort();
                setPhase("form");
              }}
              className="mt-6 text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          // ── Form ────────────────────────────────────────────────
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2">✕</button>
              </div>
            )}

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Industry + Company Type (side by side) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value as AiIndustry)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {INDUSTRIES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Size</label>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value as AiCompanyType)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {COMPANY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tone + Audience */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as AiTone)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {TONES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as AiAudience)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {AUDIENCES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hiring Goals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Hiring Goals <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={hiringGoals}
                onChange={(e) => setHiringGoals(e.target.value)}
                placeholder="e.g., Hiring 20 engineers, expanding to EMEA, building AI team"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Additional Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Additional Instructions <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Any specific requirements, brand guidelines, or content preferences…"
                rows={3}
                maxLength={2000}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{prompt.length}/2000</p>
            </div>

            {/* What will be generated */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">What AI will generate:</h4>
              <div className="grid grid-cols-2 gap-1 text-xs text-blue-700">
                <div>📄 Home / Careers page</div>
                <div>💼 Job Listings page</div>
                <div>🏢 About Us page</div>
                <div>🎯 Culture & Values page</div>
                <div>🎁 Benefits & Perks page</div>
                <div>📞 Contact page</div>
              </div>
              <p className="text-xs text-blue-500 mt-2">
                Each page gets 5-8 blocks with AI-generated content matching your brand.
                You can review and edit everything before applying.
              </p>
            </div>
          </div>
        )}

        {/* Footer (only in form phase) */}
        {phase === "form" && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Costs ~5 AI credits · Takes ~60 seconds
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!companyName.trim()}
                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ✨ Generate Site
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
