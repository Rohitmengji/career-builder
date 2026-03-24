"use client";

/**
 * AI Assistant — Premium Editor UI Component v2
 *
 * ── FEATURES ──
 * 1. Subscription gating: FREE users see upgrade CTA, PRO/Enterprise can use AI
 * 2. Skeleton/shimmer loading states (not a basic spinner)
 * 3. Side-by-side diff review modal (current ↔ AI suggestion)
 * 4. Field-level checkboxes for selective apply
 * 5. "AI-generated content" trust labels + confidence indicator
 * 6. Smooth transitions between all states
 * 7. Auto-scroll to changed fields in review
 * 8. Block highlight flash after apply
 * 9. Tone / Industry / Audience context selectors
 * 10. Full-page generation support
 * 11. Error recovery with retry, abort on unmount
 */

import { useState, useCallback, useRef, useMemo, useEffect, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type {
  AiAction,
  AiTone,
  AiIndustry,
  AiAudience,
  AiRequest,
  AiResponse,
  AiPreviewState,
  AiPageBlock,
  SubscriptionPlan,
} from "@/lib/ai/types";
import { AI_LIMITS } from "@/lib/ai/types";
import { blockSchemas, type BlockSchema, type BlockField } from "@/lib/blockSchemas";
import { useSubscription } from "@/lib/ai/useSubscription";
import { csrfHeaders } from "@/lib/csrf";
import UpgradeModal from "./UpgradeModal";
import BillingPortalButton from "./BillingPortalButton";

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface AiAssistantProps {
  blockType: string;
  currentProps: Record<string, any>;
  context?: {
    companyName?: string;
    industry?: string;
    pageType?: string;
    existingBlockTypes?: string[];
  };
  onApply: (newProps: Record<string, any>) => void;
  onApplyPage?: (blocks: AiPageBlock[]) => void;
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const TONE_OPTIONS: { value: AiTone; label: string; icon: string }[] = [
  { value: "professional", label: "Professional", icon: "🏢" },
  { value: "friendly", label: "Friendly", icon: "😊" },
  { value: "bold", label: "Bold", icon: "⚡" },
  { value: "minimal", label: "Minimal", icon: "✨" },
  { value: "hiring-focused", label: "Hiring-focused", icon: "🎯" },
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

const AUDIENCE_OPTIONS: { value: AiAudience; label: string }[] = [
  { value: "general", label: "General" },
  { value: "engineers", label: "Engineers" },
  { value: "designers", label: "Designers" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "executives", label: "Executives" },
];

const BLOCK_ACTION_OPTIONS: { value: AiAction; label: string; icon: string; desc: string }[] = [
  { value: "generate", label: "Generate", icon: "✨", desc: "Create from scratch" },
  { value: "improve", label: "Improve", icon: "🔄", desc: "Refine existing" },
  { value: "expand", label: "Expand", icon: "📝", desc: "Add more detail" },
];

/* ================================================================== */
/*  Diff helpers                                                       */
/* ================================================================== */

function getChangedFields(
  original: Record<string, any>,
  generated: Record<string, any>,
): Set<string> {
  const changed = new Set<string>();
  for (const key of Object.keys(generated)) {
    const orig = JSON.stringify(original[key]);
    const gen = JSON.stringify(generated[key]);
    if (orig !== gen) changed.add(key);
  }
  return changed;
}

function truncate(val: unknown, max = 100): string {
  if (val === undefined || val === null) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return `[${val.length} item${val.length !== 1 ? "s" : ""}]`;
  const str = String(val);
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/* ================================================================== */
/*  Shimmer / Skeleton components                                      */
/* ================================================================== */

function ShimmerLine({ width = "100%", height = "14px" }: { width?: string; height?: string }) {
  return (
    <div
      className="rounded-md bg-linear-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse"
      style={{ width, height }}
    />
  );
}

function LoadingSkeleton({ fieldCount = 4 }: { fieldCount?: number }) {
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-purple-200 animate-pulse" />
        <ShimmerLine width="60%" height="16px" />
      </div>
      {Array.from({ length: fieldCount }).map((_, i) => (
        <div key={i} className="space-y-2">
          <ShimmerLine width={`${30 + Math.random() * 30}%`} height="10px" />
          <ShimmerLine height={i % 3 === 0 ? "48px" : "36px"} />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
        <span className="text-xs text-purple-600 font-medium">AI is analyzing your content…</span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function AiAssistant({
  blockType,
  currentProps,
  context,
  onApply,
  onApplyPage,
}: AiAssistantProps) {
  /* ── Subscription ──────────────────────────────────────────── */
  const { status: subscription, decrementCredit, setPlan } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  /* ── Core state ────────────────────────────────────────────── */
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<AiAction>("improve");
  const [tone, setTone] = useState<AiTone>("professional");
  const [industry, setIndustry] = useState<AiIndustry>(
    (context?.industry as AiIndustry) || "technology",
  );
  const [audience, setAudience] = useState<AiAudience>("general");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AiPreviewState | null>(null);
  const [pageBlocks, setPageBlocks] = useState<AiPageBlock[] | null>(null);
  const [successToast, setSuccessToast] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  /* ── Review state ──────────────────────────────────────────── */
  const [editableProps, setEditableProps] = useState<Record<string, any>>({});
  const [editablePageBlocks, setEditablePageBlocks] = useState<AiPageBlock[]>([]);
  const [expandedPageBlock, setExpandedPageBlock] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"changes" | "all">("changes");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schema: BlockSchema | undefined = blockSchemas[blockType];
  const promptLength = customPrompt.length;
  const isPromptTooLong = promptLength > AI_LIMITS.MAX_PROMPT_LENGTH;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* ── Call AI API ─────────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    if (isPromptTooLong) return;
    if (!subscription.aiEnabled) {
      setShowUpgrade(true);
      return;
    }
    if (subscription.aiCreditsRemaining <= 0) {
      setError("No AI credits remaining. Please upgrade your plan or wait for your credits to reset.");
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setError(null);
    setLoading(true);
    setPreview(null);
    setPageBlocks(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const request: AiRequest = {
      action,
      blockType: action === "generate-page" ? "hero" : blockType,
      currentProps: action !== "generate" && action !== "generate-page" ? currentProps : undefined,
      prompt: customPrompt || undefined,
      tone,
      context: {
        ...context,
        industry,
        audience,
      },
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

      // Decrement AI credit on success
      decrementCredit();

      if (action === "generate-page" && data.blocks) {
        setPageBlocks(data.blocks);
        setEditablePageBlocks(JSON.parse(JSON.stringify(data.blocks)));
        setExpandedPageBlock(null);
        setShowReviewModal(true);
      } else if (data.props) {
        const previewState: AiPreviewState = {
          action,
          blockType,
          originalProps: currentProps,
          generatedProps: data.props,
          explanation: data.explanation || "",
          isEditing: false,
        };
        setPreview(previewState);
        const generated = JSON.parse(JSON.stringify(data.props));
        setEditableProps(generated);
        // Auto-select all changed fields
        const changed = getChangedFields(currentProps, generated);
        setSelectedFields(new Set(changed));
        setActiveTab("changes");
        setShowReviewModal(true);
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
  }, [action, blockType, currentProps, customPrompt, tone, context, industry, audience, isPromptTooLong, subscription.aiEnabled, subscription.aiCreditsRemaining, decrementCredit]);

  /* ── Accept / Reject ─────────────────────────────────────── */
  const handleAccept = useCallback(() => {
    if (preview) {
      // Only apply selected fields
      const propsToApply: Record<string, any> = {};
      for (const fieldName of selectedFields) {
        propsToApply[fieldName] = editableProps[fieldName];
      }
      onApply(propsToApply);
      setPreview(null);
    }
    setShowReviewModal(false);
    setIsOpen(false);
    setCustomPrompt("");
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  }, [preview, editableProps, selectedFields, onApply]);

  const handleAcceptPage = useCallback(() => {
    if (editablePageBlocks.length > 0 && onApplyPage) {
      onApplyPage(editablePageBlocks);
      setPageBlocks(null);
      setEditablePageBlocks([]);
      setShowReviewModal(false);
      setIsOpen(false);
      setCustomPrompt("");
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    }
  }, [editablePageBlocks, onApplyPage]);

  const handleReject = useCallback(() => {
    setPreview(null);
    setPageBlocks(null);
    setEditablePageBlocks([]);
    setShowReviewModal(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    handleGenerate();
  }, [handleGenerate]);

  /* ── Field selection toggle ────────────────────────────────── */
  const toggleField = useCallback((fieldName: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldName)) next.delete(fieldName);
      else next.add(fieldName);
      return next;
    });
  }, []);

  const toggleAllFields = useCallback((fields: string[], checked: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      for (const f of fields) {
        if (checked) next.add(f);
        else next.delete(f);
      }
      return next;
    });
  }, []);

  /* ── Upgrade handler ───────────────────────────────────────── */
  const handleUpgrade = useCallback((plan: SubscriptionPlan) => {
    setPlan(plan);
    setShowUpgrade(false);
  }, [setPlan]);

  /* ── Diff data ─────────────────────────────────────────────── */
  const changedFields = useMemo(() => {
    if (!preview) return new Set<string>();
    return getChangedFields(preview.originalProps, preview.generatedProps);
  }, [preview]);

  const visibleFields = useMemo(() => {
    return schema?.fields.filter((f) => f.type !== "image") || [];
  }, [schema]);

  /* ── Credits display ───────────────────────────────────────── */
  const creditsText = `${subscription.aiCreditsRemaining.toLocaleString()}/${subscription.aiCreditsTotal.toLocaleString()}`;
  const noCredits = subscription.aiEnabled && subscription.aiCreditsRemaining <= 0;

  /* ================================================================ */
  /*  COLLAPSED STATE                                                  */
  /* ================================================================ */
  if (!isOpen) {
    return (
      <>
        {/* Success toast */}
        {successToast && (
          <div
            className="mt-3 px-3 py-2.5 rounded-xl bg-linear-to-r from-green-50 to-emerald-50 border border-green-200 flex items-center gap-2 animate-slide-down"
          >
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px]">✓</span>
            </div>
            <div>
              <p className="text-[11px] text-green-800 font-semibold">Changes applied successfully</p>
              <p className="text-[10px] text-green-600">Your content has been updated</p>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-100">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <span className="text-white text-xs">✦</span>
              </div>
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">AI Assistant</span>
            </div>
            {subscription.aiEnabled && (
              <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                noCredits ? "text-red-600 bg-red-50" : "text-gray-400 bg-gray-50"
              }`}>
                {creditsText} credits
              </span>
            )}
          </div>

          {/* Billing info bar — for active subscribers */}
          {subscription.hasStripeCustomer && subscription.plan !== "free" && (
            <div className="mb-3 flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-500">
                  {subscription.plan === "pro" ? "⚡ Pro" : "🏢 Enterprise"}
                  {subscription.subscriptionStatus === "active" && (
                    <span className="ml-1.5 text-green-600">• Active</span>
                  )}
                  {subscription.subscriptionStatus === "past_due" && (
                    <span className="ml-1.5 text-amber-600">• Payment Due</span>
                  )}
                  {subscription.subscriptionStatus === "canceled" && (
                    <span className="ml-1.5 text-red-500">• Canceled</span>
                  )}
                </span>
                {subscription.aiCreditsResetAt && (
                  <span className="text-[9px] text-gray-400">
                    Renews {new Date(subscription.aiCreditsResetAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
              <BillingPortalButton compact />
            </div>
          )}

          {/* No credits warning */}
          {noCredits && (
            <div className="mb-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[10px] font-bold text-red-700 mb-0.5">⚠ No AI credits remaining</p>
              <p className="text-[9px] text-red-600">
                Upgrade your plan or wait for credits to reset.
                {subscription.aiCreditsResetAt && (
                  <> Resets {new Date(subscription.aiCreditsResetAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</>
                )}
              </p>
            </div>
          )}

          {/* Quick action buttons */}
          {subscription.aiEnabled ? (
            <div className="grid grid-cols-2 gap-1.5">
              {BLOCK_ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setAction(opt.value); setIsOpen(true); }}
                  className="group flex items-center gap-2 px-3 py-2.5 rounded-xl text-left
                             bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50
                             transition-all duration-200"
                >
                  <span className="text-sm group-hover:scale-110 transition-transform">{opt.icon}</span>
                  <div>
                    <span className="block text-[11px] font-semibold text-gray-800">{opt.label}</span>
                    <span className="block text-[9px] text-gray-400">{opt.desc}</span>
                  </div>
                </button>
              ))}
              {/* Full Page button moved to toolbar — see editor/page.tsx "✨ Generate Page" */}
            </div>
          ) : (
            /* ── FREE plan: locked state ──────────────────────── */
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full p-4 rounded-xl bg-linear-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300
                         hover:border-purple-300 hover:from-purple-50 hover:to-indigo-50
                         transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                  <span className="text-lg">🔒</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-700 group-hover:text-purple-700 transition-colors">
                    Unlock AI-Powered Editing
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Upgrade to Pro to generate, improve & expand content with AI
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-center gap-1">
                <span className="text-[10px] font-bold text-purple-600 group-hover:text-purple-700">
                  See plans →
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Pending review indicator */}
        {!showReviewModal && (preview || editablePageBlocks.length > 0) && (
          <div
            className="mt-3 p-3 rounded-xl bg-linear-to-r from-purple-50 to-indigo-50 border border-purple-200 animate-slide-down"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <p className="text-[11px] font-semibold text-purple-800">
                {preview ? `${changedFields.size} AI changes ready` : `${editablePageBlocks.length} blocks generated`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReviewModal(true)}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-sm"
              >
                Review & Apply
              </button>
              <button
                onClick={handleReject}
                className="py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Upgrade modal */}
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
  /*  EXPANDED STATE — AI panel                                        */
  /* ================================================================ */
  return (
    <div className="mt-4 pt-4 border-t border-purple-200 animate-slide-down">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs">✦</span>
          </div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          {subscription.aiEnabled && (
            <span className="text-[9px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
              {creditsText}
            </span>
          )}
          <button
            onClick={() => { setIsOpen(false); setPreview(null); setPageBlocks(null); setError(null); }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      </div>

      {/* Action selector */}
      <div className={`grid gap-1.5 mb-4 ${onApplyPage ? "grid-cols-4" : "grid-cols-3"}`}>
        {BLOCK_ACTION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setAction(opt.value)}
            className={`flex flex-col items-center gap-0.5 p-2.5 rounded-xl text-center transition-all duration-200 border ${
              action === opt.value
                ? "border-purple-400 bg-purple-50 text-purple-800 shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="text-sm">{opt.icon}</span>
            <span className="text-[10px] font-bold">{opt.label}</span>
          </button>
        ))}
        {/* Full Page tab moved to toolbar — see editor/page.tsx "✨ Generate Page" */}
      </div>

      {/* Context selectors: Tone + Industry + Audience */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        <div>
          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Tone</label>
          <select
            value={tone}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setTone(e.target.value as AiTone)}
            className="w-full border border-gray-200 p-1.5 rounded-lg text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all"
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
            className="w-full border border-gray-200 p-1.5 rounded-lg text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all"
          >
            {INDUSTRY_OPTIONS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Audience</label>
          <select
            value={audience}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setAudience(e.target.value as AiAudience)}
            className="w-full border border-gray-200 p-1.5 rounded-lg text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all"
          >
            {AUDIENCE_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom prompt */}
      <div className="mb-4">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
          {action === "generate-page" ? "Describe your page" : "Instructions (optional)"}
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={
            action === "generate-page"
              ? "e.g., Create a careers page for a fintech startup hiring engineers…"
              : action === "generate"
                ? "e.g., Focus on engineering roles at a growing startup…"
                : "e.g., Make it more concise and action-oriented…"
          }
          className={`w-full border p-2.5 rounded-xl text-xs min-h-14 resize-y
                     focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400
                     transition-all ${isPromptTooLong ? "border-red-300 bg-red-50" : "border-gray-200"}`}
          rows={2}
          maxLength={AI_LIMITS.MAX_PROMPT_LENGTH + 100}
        />
        <div className="flex justify-between mt-0.5">
          {isPromptTooLong && (
            <p className="text-[10px] text-red-500 font-medium">Max {AI_LIMITS.MAX_PROMPT_LENGTH} characters</p>
          )}
          <p className={`text-[10px] ml-auto ${isPromptTooLong ? "text-red-400" : "text-gray-300"}`}>
            {promptLength}/{AI_LIMITS.MAX_PROMPT_LENGTH}
          </p>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || isPromptTooLong || subscription.aiCreditsRemaining <= 0}
        className="w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-200
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
            <span className="text-sm">✦</span>
            <span>
              {action === "generate-page"
                ? "Generate Full Page"
                : action === "generate"
                  ? "Generate Content"
                  : action === "improve"
                    ? "Improve Content"
                    : "Expand Content"}
            </span>
          </>
        )}
      </button>

      {/* Shimmer loading state below button */}
      {loading && (
        <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/30 p-4">
          <LoadingSkeleton fieldCount={schema?.fields.filter((f) => f.type !== "image").length || 4} />
        </div>
      )}

      {/* Error with retry */}
      {error && (
        <div
          className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 animate-slide-down"
        >
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-red-600 text-[10px] font-bold">!</span>
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-red-700 font-medium">{error}</p>
              {error.includes("OPENAI_API_KEY") && (
                <p className="text-[10px] text-red-500 mt-1">
                  Add <code className="bg-red-100 px-1 rounded">OPENAI_API_KEY</code> to{" "}
                  <code className="bg-red-100 px-1 rounded">.env.local</code>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRetry}
            className="mt-2 w-full py-1.5 text-[11px] font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Pending review indicator */}
      {!showReviewModal && (preview || editablePageBlocks.length > 0) && (
        <div
          className="mt-3 p-3 rounded-xl bg-linear-to-r from-purple-50 to-indigo-50 border border-purple-200 animate-slide-down"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <p className="text-[11px] font-semibold text-purple-800">
              {preview ? `${changedFields.size} AI changes ready` : `${editablePageBlocks.length} blocks generated`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-sm"
            >
              Review & Apply
            </button>
            <button
              onClick={handleReject}
              className="py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Review Modal ────────────────────────────────────── */}
      {showReviewModal && (preview || editablePageBlocks.length > 0) && createPortal(
        <ReviewModal
          preview={preview}
          editableProps={editableProps}
          setEditableProps={setEditableProps}
          editablePageBlocks={editablePageBlocks}
          setEditablePageBlocks={setEditablePageBlocks}
          expandedPageBlock={expandedPageBlock}
          setExpandedPageBlock={setExpandedPageBlock}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          changedFields={changedFields}
          visibleFields={visibleFields}
          selectedFields={selectedFields}
          toggleField={toggleField}
          toggleAllFields={toggleAllFields}
          schema={schema}
          onAccept={preview ? handleAccept : handleAcceptPage}
          onDiscard={handleReject}
          onRetry={handleRetry}
          loading={loading}
        />,
        document.body,
      )}

      {/* Upgrade modal */}
      {showUpgrade && (
        <UpgradeModal
          currentPlan={subscription.plan}
          hasStripeCustomer={subscription.hasStripeCustomer}
          subscriptionStatus={subscription.subscriptionStatus}
          onUpgrade={handleUpgrade}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Editable field input renderer                                      */
/* ================================================================== */

function EditableField({
  field,
  value,
  originalValue,
  isChanged,
  onChange,
}: {
  field: BlockField;
  value: any;
  originalValue?: any;
  isChanged: boolean;
  onChange: (val: any) => void;
}) {
  const renderOriginal = isChanged && originalValue !== undefined && originalValue !== null;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
        </label>
        <span className="text-xs text-gray-600">{value ? "Yes" : "No"}</span>
        {renderOriginal && (
          <span className="text-[10px] text-gray-400 line-through ml-2">
            was: {originalValue ? "Yes" : "No"}
          </span>
        )}
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <div>
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border p-2 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all ${
            isChanged ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200"
          }`}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {renderOriginal && (
          <p className="text-[10px] text-gray-400 mt-0.5 line-through">
            was: {field.options.find((o) => o.value === originalValue)?.label || originalValue}
          </p>
        )}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`w-full border p-2.5 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all ${
            isChanged ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200"
          }`}
        />
        {renderOriginal && (
          <p className="text-[10px] text-gray-400 mt-0.5 line-through max-h-12 overflow-hidden">
            was: {truncate(originalValue, 200)}
          </p>
        )}
      </div>
    );
  }

  if (field.type === "list" && Array.isArray(value)) {
    return (
      <EditableListField
        field={field}
        value={value}
        originalValue={originalValue}
        isChanged={isChanged}
        onChange={onChange}
      />
    );
  }

  // text, image, or fallback
  return (
    <div>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all ${
          isChanged ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200"
        }`}
      />
      {renderOriginal && (
        <p className="text-[10px] text-gray-400 mt-0.5 line-through">
          was: {truncate(originalValue, 150)}
        </p>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Editable list field                                                */
/* ================================================================== */

function EditableListField({
  field,
  value,
  originalValue,
  isChanged,
  onChange,
}: {
  field: BlockField;
  value: any[];
  originalValue?: any;
  isChanged: boolean;
  onChange: (val: any[]) => void;
}) {
  const listFields = field.listFields || [];

  const handleItemChange = (itemIdx: number, subFieldName: string, newVal: string) => {
    const updated = value.map((item, i) =>
      i === itemIdx ? { ...item, [subFieldName]: newVal } : item,
    );
    onChange(updated);
  };

  const handleAddItem = () => {
    const newItem: Record<string, string> = {};
    listFields.forEach((lf) => { newItem[lf.name] = lf.default || ""; });
    onChange([...value, newItem]);
  };

  const handleRemoveItem = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className={`border rounded-xl p-3 space-y-2 ${isChanged ? "border-emerald-300 bg-emerald-50/20" : "border-gray-200"}`}>
      {value.map((item, itemIdx) => (
        <div key={itemIdx} className="bg-white border border-gray-100 rounded-lg p-2.5 relative group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Item {itemIdx + 1}</span>
            <button
              type="button"
              onClick={() => handleRemoveItem(itemIdx)}
              className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕ Remove
            </button>
          </div>
          {listFields.map((lf) => (
            <div key={lf.name} className="mb-1.5">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">{lf.label}</label>
              {lf.type === "textarea" ? (
                <textarea
                  value={item[lf.name] ?? ""}
                  onChange={(e) => handleItemChange(itemIdx, lf.name, e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 p-1.5 rounded-lg text-xs resize-y focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              ) : (
                <input
                  type="text"
                  value={item[lf.name] ?? ""}
                  onChange={(e) => handleItemChange(itemIdx, lf.name, e.target.value)}
                  className="w-full border border-gray-200 p-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              )}
            </div>
          ))}
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
      >
        + Add Item
      </button>
      {isChanged && Array.isArray(originalValue) && (
        <p className="text-[10px] text-gray-400">
          Original had {originalValue.length} item{originalValue.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Review Modal — Side-by-side diff + field-level checkboxes          */
/* ================================================================== */

function ReviewModal({
  preview,
  editableProps,
  setEditableProps,
  editablePageBlocks,
  setEditablePageBlocks,
  expandedPageBlock,
  setExpandedPageBlock,
  activeTab,
  setActiveTab,
  changedFields,
  visibleFields,
  selectedFields,
  toggleField,
  toggleAllFields,
  schema,
  onAccept,
  onDiscard,
  onRetry,
  loading,
}: {
  preview: AiPreviewState | null;
  editableProps: Record<string, any>;
  setEditableProps: (props: Record<string, any>) => void;
  editablePageBlocks: AiPageBlock[];
  setEditablePageBlocks: (blocks: AiPageBlock[]) => void;
  expandedPageBlock: number | null;
  setExpandedPageBlock: (idx: number | null) => void;
  activeTab: "changes" | "all";
  setActiveTab: (tab: "changes" | "all") => void;
  changedFields: Set<string>;
  visibleFields: BlockField[];
  selectedFields: Set<string>;
  toggleField: (name: string) => void;
  toggleAllFields: (fields: string[], checked: boolean) => void;
  schema: BlockSchema | undefined;
  onAccept: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  loading: boolean;
}) {
  const isPageMode = !preview && editablePageBlocks.length > 0;
  const changedFieldNames = useMemo(() => Array.from(changedFields), [changedFields]);
  const allChanged = changedFieldNames.every((f) => selectedFields.has(f));
  const noneChanged = changedFieldNames.every((f) => !selectedFields.has(f));
  const selectedCount = changedFieldNames.filter((f) => selectedFields.has(f)).length;

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setEditableProps({ ...editableProps, [fieldName]: value });
  }, [editableProps, setEditableProps]);

  const handlePageBlockFieldChange = useCallback((blockIdx: number, fieldName: string, value: any) => {
    const updated = editablePageBlocks.map((b, i) =>
      i === blockIdx ? { ...b, props: { ...b.props, [fieldName]: value } } : b,
    );
    setEditablePageBlocks(updated);
  }, [editablePageBlocks, setEditablePageBlocks]);

  const handleResetField = useCallback((fieldName: string) => {
    if (preview) {
      setEditableProps({ ...editableProps, [fieldName]: preview.generatedProps[fieldName] });
    }
  }, [preview, editableProps, setEditableProps]);

  const fieldsToShow = activeTab === "changes"
    ? visibleFields.filter((f) => changedFields.has(f.name))
    : visibleFields;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onDiscard(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[94vw] max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-modal-in"
      >
        {/* ── Modal header ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-linear-to-r from-purple-50 via-indigo-50 to-blue-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-base">✦</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {isPageMode ? "Review Generated Page" : "Review AI Changes"}
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                {isPageMode
                  ? `${editablePageBlocks.length} blocks generated`
                  : (
                    <>
                      <span>{preview?.explanation || `${changedFields.size} fields changed`}</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        AI-generated
                      </span>
                    </>
                  )}
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

        {/* ── Modal body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isPageMode ? (
            /* ── Full page review ──────────────────────────── */
            <div className="space-y-3">
              {editablePageBlocks.map((block, blockIdx) => {
                const blockSchema = blockSchemas[block.type];
                const isExpanded = expandedPageBlock === blockIdx;
                const blockFields = blockSchema?.fields.filter((f: BlockField) => f.type !== "image") || [];

                return (
                  <div key={blockIdx} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedPageBlock(isExpanded ? null : blockIdx)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <span className="w-7 h-7 rounded-lg bg-linear-to-br from-purple-100 to-indigo-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                        {blockIdx + 1}
                      </span>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-800">
                          {blockSchema?.label || block.type}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                            {blockSchema?.category}
                          </span>
                          <span className="text-[9px] text-gray-400">{blockFields.length} fields</span>
                        </div>
                      </div>
                      <span className={`text-xs transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 py-3 space-y-3 border-t border-gray-100">
                        {blockFields.map((field: BlockField) => (
                          <div key={field.name}>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              {field.label}
                            </label>
                            <EditableField
                              field={field}
                              value={block.props[field.name]}
                              isChanged={true}
                              onChange={(val) => handlePageBlockFieldChange(blockIdx, field.name, val)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : preview && (
            /* ── Single block side-by-side diff review ─────── */
            <div>
              {/* Tab bar + select all */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("changes")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
                      activeTab === "changes"
                        ? "bg-white text-purple-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Changed ({changedFields.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("all")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
                      activeTab === "all"
                        ? "bg-white text-purple-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    All ({visibleFields.length})
                  </button>
                </div>
                {activeTab === "changes" && changedFieldNames.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allChanged}
                      ref={(el) => { if (el) el.indeterminate = !allChanged && !noneChanged; }}
                      onChange={() => toggleAllFields(changedFieldNames, !allChanged)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 transition-colors"
                    />
                    <span className="text-[10px] font-semibold text-gray-500">
                      Apply all ({selectedCount}/{changedFieldNames.length})
                    </span>
                  </label>
                )}
              </div>

              {/* Fields with side-by-side diff */}
              <div className="space-y-3">
                {fieldsToShow.map((field) => {
                  const isChanged = changedFields.has(field.name);
                  const isSelected = selectedFields.has(field.name);
                  return (
                    <div
                      key={field.name}
                      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                        isChanged
                          ? isSelected
                            ? "border-purple-200 bg-purple-50/20"
                            : "border-gray-200 bg-gray-50/50 opacity-60"
                          : "border-gray-100"
                      }`}
                    >
                      {/* Field header with checkbox */}
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80">
                        {isChanged && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleField(field.name)}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer transition-colors"
                          />
                        )}
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-2 flex-1">
                          {field.label}
                          {isChanged && (
                            <span className="text-[8px] font-extrabold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase">
                              Modified
                            </span>
                          )}
                        </label>
                        {isChanged && (
                          <button
                            type="button"
                            onClick={() => handleResetField(field.name)}
                            className="text-[10px] text-purple-500 hover:text-purple-700 font-semibold transition-colors"
                            title="Reset to AI suggestion"
                          >
                            ↺ Reset
                          </button>
                        )}
                      </div>

                      {/* Side-by-side diff for changed fields */}
                      {isChanged && preview ? (
                        <div className="grid grid-cols-2 gap-0 border-t border-gray-100">
                          {/* LEFT: Current (original) */}
                          <div className="p-3 border-r border-gray-100 bg-red-50/30">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              <span className="text-[9px] font-bold text-red-500 uppercase">Current</span>
                            </div>
                            <div className="text-xs text-gray-600 bg-white/60 rounded-lg p-2 border border-red-100 min-h-8">
                              {field.type === "list" && Array.isArray(preview.originalProps[field.name])
                                ? `${preview.originalProps[field.name].length} item${preview.originalProps[field.name].length !== 1 ? "s" : ""}`
                                : truncate(preview.originalProps[field.name], 300)}
                            </div>
                          </div>
                          {/* RIGHT: AI suggestion (editable) */}
                          <div className="p-3 bg-emerald-50/30">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[9px] font-bold text-emerald-600 uppercase">AI Suggestion</span>
                            </div>
                            <EditableField
                              field={field}
                              value={editableProps[field.name]}
                              isChanged={false}
                              onChange={(val) => handleFieldChange(field.name, val)}
                            />
                          </div>
                        </div>
                      ) : (
                        /* Non-changed fields: just show editable */
                        <div className="px-4 pb-3">
                          <EditableField
                            field={field}
                            value={editableProps[field.name]}
                            originalValue={preview?.originalProps[field.name]}
                            isChanged={false}
                            onChange={(val) => handleFieldChange(field.name, val)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Modal footer ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/80 shrink-0">
          <button
            onClick={onRetry}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
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
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Discard
            </button>
            <button
              onClick={onAccept}
              disabled={!isPageMode && selectedCount === 0}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200
                         bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500
                         disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                         text-white shadow-sm hover:shadow-md"
            >
              {isPageMode
                ? `✓ Apply ${editablePageBlocks.length} Blocks`
                : `✓ Apply ${selectedCount} Change${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
