/*
 * Onboarding Flow — /onboarding
 *
 * New user setup wizard:
 *   Step 1: Choose a career page template
 *   Step 2: Enter company details (name, logo, primary color)
 *   Step 3: Generate site → redirects to editor
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  blockCount: number;
}

interface TemplateDetail {
  id: string;
  name: string;
  blocks: { type: string; props: Record<string, any> }[];
}

const COLOR_OPTIONS = [
  { name: "Blue",    hex: "#2563eb" },
  { name: "Indigo",  hex: "#4f46e5" },
  { name: "Purple",  hex: "#9333ea" },
  { name: "Teal",    hex: "#0d9488" },
  { name: "Green",   hex: "#16a34a" },
  { name: "Orange",  hex: "#ea580c" },
  { name: "Red",     hex: "#dc2626" },
  { name: "Gray",    hex: "#4b5563" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { authenticated, loading: authLoading } = useAuthGuard();

  // Load templates
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setTemplates([]));
  }, []);

  // Step 3: Apply template to editor
  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate || !companyName.trim()) return;
    setGenerating(true);
    setError("");

    try {
      // 1. Load full template
      const tplRes = await fetch(`/api/templates?id=${selectedTemplate}`);
      if (!tplRes.ok) throw new Error("Failed to load template");
      const template: TemplateDetail = await tplRes.json();

      // 2. Customize blocks with company info
      const customizedBlocks = template.blocks.map((block) => {
        const props = { ...block.props };

        // Replace company name in navbars and footers
        if (block.type === "navbar" || block.type === "footer") {
          if (props.companyName) props.companyName = companyName;
          if (props.copyright) props.copyright = `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`;
          if (props.description) props.description = `${companyName} — Building the future together.`;
          if (logoUrl && block.type === "navbar") props.logoUrl = logoUrl;
        }

        return { type: block.type, props };
      });

      // 3. Save as page
      const csrf = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/)?.[1] || "";
      const saveRes = await fetch("/api/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ slug: "careers", blocks: customizedBlocks }),
      });

      if (!saveRes.ok) throw new Error("Failed to save page");

      // 4. Update tenant branding
      await fetch("/api/tenants", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({
          name: companyName,
          theme: {
            colors: { primary: primaryColor },
            ...(logoUrl ? { branding: { logoUrl } } : {}),
          },
        }),
      });

      // 5. Navigate to editor
      router.push("/editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  }, [selectedTemplate, companyName, logoUrl, primaryColor, router]);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {step === 1 && "Choose a Template"}
              {step === 2 && "Your Company Details"}
              {step === 3 && "Creating Your Career Page"}
            </h1>
            <p className="text-gray-500 mt-2">
              {step === 1 && "Pick a starting point for your career page. You can customize everything later."}
              {step === 2 && "Tell us about your company so we can personalize your page."}
              {step === 3 && "We're setting everything up for you..."}
            </p>
            <p className="text-xs text-gray-400 mt-1">Step {step} of 3</p>
          </div>

          {/* Step 1: Template Selection */}
          {step === 1 && (
            <div>
              <div className="grid gap-4">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                      selectedTemplate === tpl.id
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{tpl.thumbnail}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{tpl.name}</div>
                        <div className="text-sm text-gray-500 mt-1">{tpl.description}</div>
                        <div className="text-xs text-gray-400 mt-2">{tpl.blockCount} sections</div>
                      </div>
                      {selectedTemplate === tpl.id && (
                        <span className="text-blue-600 text-lg">✓</span>
                      )}
                    </div>
                  </button>
                ))}

                {/* Blank option */}
                <button
                  onClick={() => setSelectedTemplate("blank")}
                  className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                    selectedTemplate === "blank"
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                      : "border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">📄</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Start from Scratch</div>
                      <div className="text-sm text-gray-500 mt-1">Begin with a blank canvas and build your own layout.</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => selectedTemplate && setStep(2)}
                  disabled={!selectedTemplate}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Company Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo URL (optional)</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://your-company.com/logo.png"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Color</label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setPrimaryColor(c.hex)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        primaryColor === c.hex ? "border-gray-900 ring-2 ring-offset-2 ring-gray-400" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    if (!companyName.trim()) {
                      setError("Company name is required");
                      return;
                    }
                    setError("");
                    if (selectedTemplate === "blank") {
                      router.push("/editor");
                    } else {
                      setStep(3);
                      handleGenerate();
                    }
                  }}
                  disabled={!companyName.trim()}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {selectedTemplate === "blank" ? "Open Editor" : "Create My Page →"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 3 && (
            <div className="text-center py-12">
              {generating ? (
                <>
                  <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6" />
                  <p className="text-gray-600 font-medium">Creating your career page...</p>
                  <p className="text-sm text-gray-400 mt-2">This only takes a moment</p>
                </>
              ) : error ? (
                <>
                  <div className="text-4xl mb-4">❌</div>
                  <p className="text-red-600 font-medium">{error}</p>
                  <button
                    onClick={() => { setStep(2); setError(""); }}
                    className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ← Go Back
                  </button>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-4">✅</div>
                  <p className="text-green-600 font-medium">Your career page is ready!</p>
                  <p className="text-sm text-gray-400 mt-2">Redirecting to editor...</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
