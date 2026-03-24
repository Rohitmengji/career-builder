"use client";

/**
 * AI Job Assistant — Smart job posting generator.
 *
 * Features:
 * - Generate complete job postings from a short prompt
 * - Fill in partial forms using AI
 * - Subscription gating (FREE locked, PRO/Enterprise can use)
 * - Side-by-side diff review before applying
 * - Field-level selection (apply only the fields you want)
 * - Premium shimmer loading, smooth transitions
 */

import { useState, useCallback, useRef, useEffect, useMemo, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type {
  AiTone,
  AiIndustry,
  AiRequest,
  AiResponse,
  AiJobFormData,
  SubscriptionPlan,
} from "@/lib/ai/types";
import { AI_LIMITS } from "@/lib/ai/types";
import { useSubscription } from "@/lib/ai/useSubscription";
import { csrfHeaders } from "@/lib/csrf";
import UpgradeModal from "@/components/editor/UpgradeModal";

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface AiJobAssistantProps {
  /** Current form data (partial) */
  currentForm: Partial<AiJobFormData>;
  /** Called when user accepts AI-generated job data */
  onApply: (job: AiJobFormData) => void;
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const TONE_OPTIONS: { value: AiTone; label: string; icon: string }[] = [
  { value: "professional", label: "Professional", icon: "🏢" },
  { value: "friendly", label: "Friendly", icon: "😊" },
  { value: "bold", label: "Bold", icon: "⚡" },
  { value: "hiring-focused", label: "Hiring", icon: "🎯" },
];

const INDUSTRY_OPTIONS: { value: AiIndustry; label: string }[] = [
  { value: "technology", label: "Technology" },
  { value: "fintech", label: "Fintech" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "ecommerce", label: "E-Commerce" },
  { value: "saas", label: "SaaS" },
  { value: "consulting", label: "Consulting" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "media", label: "Media" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
];

const JOB_FIELD_LABELS: Record<keyof AiJobFormData, string> = {
  title: "Job Title",
  department: "Department",
  location: "Location",
  description: "Description",
  employmentType: "Employment Type",
  experienceLevel: "Experience Level",
  salaryMin: "Salary Min",
  salaryMax: "Salary Max",
  isRemote: "Remote Friendly",
  isPublished: "Published",
  requirements: "Requirements",
  benefits: "Benefits",
  tags: "Tags",
};

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function truncate(val: unknown, max = 80): string {
  if (val === undefined || val === null || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const str = String(val);
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function getChangedFields(
  original: Partial<AiJobFormData>,
  generated: AiJobFormData,
): Set<keyof AiJobFormData> {
  const changed = new Set<keyof AiJobFormData>();
  const keys = Object.keys(generated) as (keyof AiJobFormData)[];
  for (const key of keys) {
    const orig = original[key];
    const gen = generated[key];
    // Consider changed if original is empty/missing or different
    if (orig === undefined || orig === null || orig === "" || orig === false) {
      if (gen !== undefined && gen !== null && gen !== "" && gen !== false) {
        changed.add(key);
      }
    } else if (JSON.stringify(orig) !== JSON.stringify(gen)) {
      changed.add(key);
    }
  }
  return changed;
}

/* ================================================================== */
/*  Shimmer skeleton                                                   */
/* ================================================================== */

function JobSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[80, 50, 40, 100, 60, 100, 70, 90].map((w, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 w-20 rounded bg-purple-100 animate-pulse" />
          <div
            className="rounded-lg bg-linear-to-r from-purple-100 via-purple-50 to-purple-100 animate-pulse"
            style={{ width: `${w}%`, height: i === 3 || i === 5 ? "48px" : "32px" }}
          />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
        <span className="text-xs text-purple-600 font-medium">AI is crafting your job posting…</span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function AiJobAssistant({ currentForm, onApply }: AiJobAssistantProps) {
  const { status: subscription, decrementJobCredit, setPlan } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [tone, setTone] = useState<AiTone>("professional");
  const [industry, setIndustry] = useState<AiIndustry>("technology");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedJob, setGeneratedJob] = useState<AiJobFormData | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<keyof AiJobFormData>>(new Set());
  const [successToast, setSuccessToast] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const promptLength = customPrompt.length;
  const isPromptTooLong = promptLength > AI_LIMITS.MAX_PROMPT_LENGTH;

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const creditsText = `${subscription.jobAiCreditsRemaining.toLocaleString()}/${subscription.jobAiCreditsTotal.toLocaleString()} / week`;

  /* ── Generate ──────────────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    if (isPromptTooLong) return;
    if (!subscription.aiEnabled) {
      setShowUpgrade(true);
      return;
    }
    if (subscription.jobAiCreditsRemaining <= 0) {
      setError("Weekly job AI credits exhausted (25/week). Credits reset weekly — please try again later.");
      return;
    }

    setError(null);
    setLoading(true);
    setGeneratedJob(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const request: AiRequest = {
      action: "generate-job",
      blockType: "job",
      currentProps: currentForm as any,
      prompt: customPrompt || undefined,
      tone,
      context: { industry },
    };

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(request),
        signal: abortRef.current.signal,
      });

      const data: AiResponse = await res.json();

      if (!data.success) {
        setError(data.error || "AI generation failed. Please try again.");
        return;
      }

      decrementJobCredit();

      if (data.props) {
        const job = data.props as unknown as AiJobFormData;
        setGeneratedJob(job);
        // Auto-select all changed fields
        const changed = getChangedFields(currentForm, job);
        setSelectedFields(new Set(changed));
        setShowReview(true);
      } else {
        setError("AI returned an empty response. Please try again.");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Network error. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }, [customPrompt, tone, industry, currentForm, isPromptTooLong, subscription.aiEnabled, subscription.jobAiCreditsRemaining, decrementJobCredit]);

  /* ── Accept / Reject ───────────────────────────────────────── */
  const handleAccept = useCallback(() => {
    if (!generatedJob) return;

    // Build a partial object with only selected fields merged
    const result: AiJobFormData = { ...(currentForm as AiJobFormData) };
    for (const field of selectedFields) {
      (result as any)[field] = generatedJob[field];
    }
    onApply(result);
    setGeneratedJob(null);
    setShowReview(false);
    setIsOpen(false);
    setCustomPrompt("");
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  }, [generatedJob, selectedFields, currentForm, onApply]);

  const handleReject = useCallback(() => {
    setGeneratedJob(null);
    setShowReview(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    handleGenerate();
  }, [handleGenerate]);

  /* ── Field toggle ──────────────────────────────────────────── */
  const toggleField = useCallback((field: keyof AiJobFormData) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const changedFields = useMemo(() => {
    if (!generatedJob) return new Set<keyof AiJobFormData>();
    return getChangedFields(currentForm, generatedJob);
  }, [generatedJob, currentForm]);

  const changedFieldNames = useMemo(() => Array.from(changedFields), [changedFields]);
  const selectedCount = changedFieldNames.filter((f) => selectedFields.has(f)).length;

  const handleUpgrade = useCallback((plan: SubscriptionPlan) => {
    setPlan(plan);
    setShowUpgrade(false);
  }, [setPlan]);

  /* ================================================================ */
  /*  COLLAPSED — AI trigger button                                    */
  /* ================================================================ */
  if (!isOpen) {
    return (
      <>
        {successToast && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-linear-to-r from-green-50 to-emerald-50 border border-green-200 flex items-center gap-2 animate-slide-down">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px]">✓</span>
            </div>
            <div>
              <p className="text-sm text-green-800 font-semibold">AI job data applied!</p>
              <p className="text-xs text-green-600">Review the fields and save when ready.</p>
            </div>
          </div>
        )}

        {subscription.aiEnabled ? (
          <button
            onClick={() => setIsOpen(true)}
            className="group w-full mb-6 p-4 rounded-xl bg-linear-to-r from-purple-50 via-indigo-50 to-blue-50
                       border border-purple-200 hover:border-purple-300 hover:from-purple-100 hover:via-indigo-100 hover:to-blue-100
                       transition-all duration-300 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <span className="text-white text-lg">✦</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">Generate with AI</p>
                <p className="text-xs text-gray-500">
                  Describe the role and let AI write the full job posting
                </p>
              </div>
              <div className={`text-[9px] font-medium px-2 py-1 rounded-full border ${
                subscription.jobAiCreditsRemaining <= 0 ? "text-red-600 bg-red-50 border-red-200" : "text-gray-400 bg-white border-gray-100"
              }`}>
                {creditsText}
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => setShowUpgrade(true)}
            className="group w-full mb-6 p-4 rounded-xl bg-linear-to-br from-gray-50 to-gray-100
                       border-2 border-dashed border-gray-300 hover:border-purple-300 hover:from-purple-50 hover:to-indigo-50
                       transition-all duration-300 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                <span className="text-lg">🔒</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 group-hover:text-purple-700 transition-colors">
                  Generate with AI
                </p>
                <p className="text-xs text-gray-500">Upgrade to Pro to auto-generate job postings</p>
              </div>
            </div>
          </button>
        )}

        {showUpgrade && (
          <UpgradeModal
            currentPlan={subscription.plan}
            hasStripeCustomer={subscription.hasStripeCustomer}
            subscriptionStatus={subscription.subscriptionStatus}
            onUpgrade={handleUpgrade}
            onClose={() => setShowUpgrade(false)}
          />
        )}
      </>
    );
  }

  /* ================================================================ */
  /*  EXPANDED — AI input panel                                        */
  /* ================================================================ */
  return (
    <>
      <div className="mb-6 rounded-xl border border-purple-200 bg-linear-to-br from-purple-50/50 to-indigo-50/50 overflow-hidden animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/60 border-b border-purple-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs">✦</span>
            </div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">AI Job Generator</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full">
              {creditsText}
            </span>
            <button
              onClick={() => { setIsOpen(false); setError(null); }}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <span className="text-xs">✕</span>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* No credits warning */}
          {subscription.aiEnabled && subscription.jobAiCreditsRemaining <= 0 && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[10px] font-bold text-red-700 mb-0.5">⚠ Weekly job AI credits exhausted</p>
              <p className="text-[9px] text-red-600">
                You&apos;ve used all 25 job AI credits this week.
                {subscription.jobAiCreditsResetAt && (
                  <> Resets {new Date(subscription.jobAiCreditsResetAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}.</>
                )}
              </p>
            </div>
          )}
          {/* Prompt */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Describe the role
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Senior React engineer for our fintech platform, remote-friendly, focus on performance…"
              className={`w-full border p-3 rounded-xl text-sm resize-y min-h-16
                         focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400
                         transition-all ${isPromptTooLong ? "border-red-300 bg-red-50" : "border-gray-200"}`}
              rows={2}
              maxLength={AI_LIMITS.MAX_PROMPT_LENGTH + 100}
            />
            <div className="flex justify-between mt-0.5">
              {isPromptTooLong && (
                <p className="text-[10px] text-red-500 font-medium">Max {AI_LIMITS.MAX_PROMPT_LENGTH} chars</p>
              )}
              <p className={`text-[10px] ml-auto ${isPromptTooLong ? "text-red-400" : "text-gray-300"}`}>
                {promptLength}/{AI_LIMITS.MAX_PROMPT_LENGTH}
              </p>
            </div>
          </div>

          {/* Tone + Industry */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Tone</label>
              <select
                value={tone}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setTone(e.target.value as AiTone)}
                className="w-full border border-gray-200 p-1.5 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Industry</label>
              <select
                value={industry}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setIndustry(e.target.value as AiIndustry)}
                className="w-full border border-gray-200 p-1.5 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all"
              >
                {INDUSTRY_OPTIONS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hint: existing form data */}
          {currentForm.title && (
            <p className="text-[10px] text-purple-600 bg-purple-50 px-2.5 py-1.5 rounded-lg">
              💡 AI will use your current form data (title: &quot;{currentForm.title}&quot;) as context
            </p>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || isPromptTooLong || subscription.jobAiCreditsRemaining <= 0}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200
                       bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500
                       disabled:from-purple-300 disabled:to-indigo-300 text-white
                       shadow-sm hover:shadow-md disabled:shadow-none
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <span>✦</span>
                <span>Generate Job Posting</span>
              </>
            )}
          </button>

          {/* Shimmer loading */}
          {loading && (
            <div className="rounded-xl border border-purple-100 bg-white/60 p-4">
              <JobSkeleton />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 animate-slide-down">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-red-600 text-[10px] font-bold">!</span>
                </div>
                <p className="text-xs text-red-700 font-medium flex-1">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="mt-2 w-full py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
              >
                🔄 Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Review Modal ──────────────────────────────────────── */}
      {showReview && generatedJob && createPortal(
        <JobReviewModal
          currentForm={currentForm}
          generatedJob={generatedJob}
          changedFields={changedFields}
          selectedFields={selectedFields}
          selectedCount={selectedCount}
          toggleField={toggleField}
          onAccept={handleAccept}
          onDiscard={handleReject}
          onRetry={handleRetry}
          loading={loading}
        />,
        document.body,
      )}

      {showUpgrade && (
        <UpgradeModal
          currentPlan={subscription.plan}
          hasStripeCustomer={subscription.hasStripeCustomer}
          subscriptionStatus={subscription.subscriptionStatus}
          onUpgrade={handleUpgrade}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  );
}

/* ================================================================== */
/*  Job Review Modal — Side-by-side diff with checkboxes               */
/* ================================================================== */

function JobReviewModal({
  currentForm,
  generatedJob,
  changedFields,
  selectedFields,
  selectedCount,
  toggleField,
  onAccept,
  onDiscard,
  onRetry,
  loading,
}: {
  currentForm: Partial<AiJobFormData>;
  generatedJob: AiJobFormData;
  changedFields: Set<keyof AiJobFormData>;
  selectedFields: Set<keyof AiJobFormData>;
  selectedCount: number;
  toggleField: (field: keyof AiJobFormData) => void;
  onAccept: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  loading: boolean;
}) {
  const fields = Object.keys(generatedJob) as (keyof AiJobFormData)[];
  const visibleFields = fields.filter((f) => changedFields.has(f));

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onDiscard(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[94vw] max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-linear-to-r from-purple-50 via-indigo-50 to-blue-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-base">✦</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Review AI-Generated Job Posting</h2>
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                <span>{visibleFields.length} fields generated</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  AI-generated
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onDiscard}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body — field diffs */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-2.5">
            {visibleFields.map((field) => {
              const isSelected = selectedFields.has(field);
              const currentVal = currentForm[field];
              const generatedVal = generatedJob[field];
              const label = JOB_FIELD_LABELS[field] || field;
              const isLongText = field === "description" || field === "requirements" || field === "benefits";

              return (
                <div
                  key={field}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                    isSelected
                      ? "border-purple-200 bg-purple-50/20"
                      : "border-gray-200 bg-gray-50/50 opacity-50"
                  }`}
                >
                  {/* Field header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleField(field)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-700 flex-1">{label}</span>
                    <span className="text-[8px] font-extrabold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase">
                      {currentVal ? "Updated" : "New"}
                    </span>
                  </div>

                  {/* Side-by-side diff */}
                  <div className={`grid ${currentVal ? "grid-cols-2" : "grid-cols-1"} gap-0 border-t border-gray-100`}>
                    {currentVal !== undefined && currentVal !== null && currentVal !== "" && currentVal !== false && (
                      <div className="p-3 border-r border-gray-100 bg-red-50/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <span className="text-[9px] font-bold text-red-500 uppercase">Current</span>
                        </div>
                        <div className={`text-xs text-gray-600 bg-white/60 rounded-lg p-2 border border-red-100 ${isLongText ? "max-h-24 overflow-y-auto" : ""}`}>
                          {typeof currentVal === "boolean" ? (currentVal ? "Yes" : "No") : truncate(currentVal, 300)}
                        </div>
                      </div>
                    )}
                    <div className="p-3 bg-emerald-50/30">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-bold text-emerald-600 uppercase">AI Suggestion</span>
                      </div>
                      <div className={`text-xs text-gray-800 bg-white/60 rounded-lg p-2 border border-emerald-100 ${isLongText ? "max-h-32 overflow-y-auto whitespace-pre-wrap" : ""}`}>
                        {typeof generatedVal === "boolean" ? (generatedVal ? "Yes" : "No") : truncate(generatedVal, 500)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/80 shrink-0">
          <button
            onClick={onRetry}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Regenerating…
              </>
            ) : (
              <>🔄 Regenerate</>
            )}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onDiscard}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              Discard
            </button>
            <button
              onClick={onAccept}
              disabled={selectedCount === 0}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200
                         bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500
                         disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                         text-white shadow-sm hover:shadow-md"
            >
              ✓ Apply {selectedCount} Field{selectedCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
