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
import {
  Button,
  Field,
  Alert,
  Card,
  Spinner,
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  XIcon,
} from "@/components/ui";

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
  useAuthGuard();

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

  const heading =
    step === 1 ? "Choose a template" :
    step === 2 ? "Your company details" :
    "Creating your career page";

  const subheading =
    step === 1 ? "Pick a starting point for your career page. You can customize everything later." :
    step === 2 ? "Tell us about your company so we can personalize your page." :
    "We're setting everything up for you…";

  return (
    <main className="min-h-screen bg-linear-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-2xl overflow-hidden p-0 shadow-md ring-1 ring-black/5">
        {/* Progress bar */}
        <div
          className="h-1.5 bg-gray-100"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={step}
          aria-label={`Step ${step} of 3`}
        >
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              Step {step} of 3
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{heading}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">{subheading}</p>
          </div>

          {/* Step 1: Template Selection */}
          {step === 1 && (
            <div>
              <div className="grid gap-3">
                {templates.map((tpl) => {
                  const active = selectedTemplate === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplate(tpl.id)}
                      aria-pressed={active}
                      className={`w-full rounded-xl border-2 p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        active
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl"
                        >
                          {tpl.thumbnail}
                        </span>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{tpl.name}</div>
                          <div className="mt-1 text-sm text-gray-600">{tpl.description}</div>
                          <div className="mt-2 text-xs text-gray-500">{tpl.blockCount} sections</div>
                        </div>
                        {active && (
                          <span
                            aria-hidden="true"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Blank option */}
                <button
                  type="button"
                  onClick={() => setSelectedTemplate("blank")}
                  aria-pressed={selectedTemplate === "blank"}
                  className={`w-full rounded-xl border-2 p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    selectedTemplate === "blank"
                      ? "border-blue-600 bg-blue-50"
                      : "border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl"
                    >
                      📄
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Start from scratch</div>
                      <div className="mt-1 text-sm text-gray-600">
                        Begin with a blank canvas and build your own layout.
                      </div>
                    </div>
                    {selectedTemplate === "blank" && (
                      <span
                        aria-hidden="true"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </button>
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={() => selectedTemplate && setStep(2)}
                  disabled={!selectedTemplate}
                >
                  Continue
                  <ArrowRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Company Details */}
          {step === 2 && (
            <div className="space-y-6">
              {error && <Alert tone="error">{error}</Alert>}

              <Field
                label="Company name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                required
              />

              <Field
                label="Logo URL"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://your-company.com/logo.png"
                hint="Optional — paste a link to your logo image."
              />

              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">Brand color</span>
                <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Brand color">
                  {COLOR_OPTIONS.map((c) => {
                    const active = primaryColor === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={c.name}
                        onClick={() => setPrimaryColor(c.hex)}
                        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                          active ? "border-gray-900" : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {active && <CheckIcon className="h-5 w-5 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back
                </Button>
                <Button
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
                >
                  {selectedTemplate === "blank" ? "Open editor" : "Create my page"}
                  <ArrowRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 3 && (
            <div className="py-12 text-center">
              {generating ? (
                <>
                  <Spinner className="mx-auto mb-6 h-10 w-10 text-blue-600" />
                  <p className="font-medium text-gray-900">Creating your career page…</p>
                  <p className="mt-2 text-sm text-gray-600">This only takes a moment.</p>
                </>
              ) : error ? (
                <>
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"
                  >
                    <XIcon className="h-7 w-7" />
                  </div>
                  <Alert tone="error" className="mx-auto max-w-sm">{error}</Alert>
                  <div className="mt-5">
                    <Button variant="ghost" onClick={() => { setStep(2); setError(""); }}>
                      <ArrowLeftIcon className="h-4 w-4" />
                      Go back
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"
                  >
                    <CheckIcon className="h-7 w-7" />
                  </div>
                  <p className="font-medium text-gray-900">Your career page is ready!</p>
                  <p className="mt-2 text-sm text-gray-600">Redirecting to the editor…</p>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}
