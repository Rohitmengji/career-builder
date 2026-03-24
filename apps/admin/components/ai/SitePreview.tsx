/**
 * SitePreview — Full-screen modal for previewing AI-generated multi-page sites.
 *
 * Features:
 *   - Page sidebar with navigation
 *   - Live block preview per page
 *   - Regenerate individual pages
 *   - Remove pages
 *   - Edit blocks before applying
 *   - Apply all / cancel
 *   - Compare with template option
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { GeneratedSite, GeneratedPage, SiteGenerationInput, PageType } from "@/lib/ai/site-generator/siteSchema";
import type { AiPageBlock } from "@/lib/ai/types";
import { blockSchemas } from "@/lib/blockSchemas";
import { REGEN_OPTIONS, type RegenOption } from "@/lib/ai/context/siteContext";
import { csrfHeaders } from "@/lib/csrf";

/* ================================================================== */
/*  Block Preview Card                                                 */
/* ================================================================== */

function BlockCard({
  block,
  index,
  onRemove,
}: {
  block: AiPageBlock;
  index: number;
  onRemove: () => void;
}) {
  const schema = blockSchemas[block.type];
  const [expanded, setExpanded] = useState(false);

  // Pick the most meaningful prop value as a preview snippet
  const previewText = block.props.title || block.props.companyName || block.props.body || block.props.subtitle || "";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden group">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-gray-400 w-5 text-right">{index + 1}</span>
          <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
            {block.type}
          </span>
          <span className="text-sm text-gray-600 truncate">
            {schema?.label || block.type}
          </span>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50"
            title="Remove block"
          >
            ✕
          </button>
          <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100">
          <div className="mt-2 space-y-1">
            {Object.entries(block.props).map(([key, value]) => {
              if (Array.isArray(value)) {
                return (
                  <div key={key} className="text-xs">
                    <span className="font-medium text-gray-500">{key}:</span>{" "}
                    <span className="text-gray-400">[{value.length} items]</span>
                  </div>
                );
              }
              if (typeof value === "boolean") {
                return (
                  <div key={key} className="text-xs">
                    <span className="font-medium text-gray-500">{key}:</span>{" "}
                    <span className={value ? "text-green-600" : "text-gray-400"}>{value ? "Yes" : "No"}</span>
                  </div>
                );
              }
              const strVal = String(value || "");
              if (!strVal) return null;
              return (
                <div key={key} className="text-xs">
                  <span className="font-medium text-gray-500">{key}:</span>{" "}
                  <span className="text-gray-700">{strVal.slice(0, 80)}{strVal.length > 80 ? "…" : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!expanded && previewText && (
        <div className="px-4 pb-2 -mt-1">
          <p className="text-xs text-gray-400 truncate italic">{previewText.slice(0, 60)}</p>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Page Preview Panel                                                 */
/* ================================================================== */

function PagePreview({
  page,
  pageIndex,
  onRegeneratePage,
  onRemovePage,
  onRemoveBlock,
  isRegenerating,
}: {
  page: GeneratedPage;
  pageIndex: number;
  onRegeneratePage: (idx: number, option?: RegenOption) => void;
  onRemovePage: (idx: number) => void;
  onRemoveBlock: (pageIdx: number, blockIdx: number) => void;
  isRegenerating: boolean;
}) {
  const [showRegenMenu, setShowRegenMenu] = useState(false);
  const regenRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showRegenMenu) return;
    const handler = (e: MouseEvent) => {
      if (regenRef.current && !regenRef.current.contains(e.target as Node)) {
        setShowRegenMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showRegenMenu]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{page.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              /{page.slug} · {page.blocks.length} blocks · {page.pageType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Smart Regeneration Dropdown */}
            <div className="relative" ref={regenRef}>
              <button
                onClick={() => setShowRegenMenu(!showRegenMenu)}
                disabled={isRegenerating}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                {isRegenerating ? "Regenerating…" : "🔄 Regenerate"}
                {!isRegenerating && <span className="text-[10px] ml-0.5">▾</span>}
              </button>
              {showRegenMenu && !isRegenerating && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Smart Regeneration
                  </div>
                  {REGEN_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setShowRegenMenu(false);
                        onRegeneratePage(pageIndex, opt);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onRemovePage(pageIndex)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              🗑 Remove Page
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">{page.description}</p>
      </div>

      {/* Blocks list */}
      <div className="p-6 space-y-2">
        {page.blocks.map((block, blockIdx) => (
          <BlockCard
            key={`${page.slug}-${blockIdx}-${block.type}`}
            block={block}
            index={blockIdx}
            onRemove={() => onRemoveBlock(pageIndex, blockIdx)}
          />
        ))}

        {page.blocks.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No blocks on this page. Click "Regenerate" to add content.
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

interface SitePreviewProps {
  site: GeneratedSite;
  input: SiteGenerationInput;
  onApply: (site: GeneratedSite) => void;
  onCancel: () => void;
  creditsUsed: number;
}

export default function SitePreview({
  site: initialSite,
  input,
  onApply,
  onCancel,
  creditsUsed,
}: SitePreviewProps) {
  const [site, setSite] = useState<GeneratedSite>(initialSite);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenCredits, setRegenCredits] = useState(0);

  // Handle page regeneration with smart options
  const handleRegeneratePage = useCallback(async (pageIndex: number, option?: RegenOption) => {
    setIsRegenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/site?action=regen", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          site,
          pageIndex,
          input,
          regenOption: option ? { id: option.id, promptSuffix: option.promptSuffix } : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Regeneration failed");
      }

      setSite(data.site);
      setRegenCredits((c) => c + (data.creditsUsed || 1));
    } catch (err: any) {
      setError(err.message || "Failed to regenerate page");
    } finally {
      setIsRegenerating(false);
    }
  }, [site, input]);

  // Handle page removal
  const handleRemovePage = useCallback((pageIndex: number) => {
    if (site.pages.length <= 1) {
      setError("Cannot remove the last page");
      return;
    }
    const pageName = site.pages[pageIndex].title;
    if (!confirm(`Remove the "${pageName}" page? This cannot be undone.`)) return;

    const newPages = site.pages.filter((_, i) => i !== pageIndex);
    setSite({ ...site, pages: newPages });

    // Adjust active index if needed
    if (activePageIdx >= newPages.length) {
      setActivePageIdx(Math.max(0, newPages.length - 1));
    }
  }, [site, activePageIdx]);

  // Handle block removal
  const handleRemoveBlock = useCallback((pageIdx: number, blockIdx: number) => {
    const newPages = [...site.pages];
    const page = { ...newPages[pageIdx] };
    page.blocks = page.blocks.filter((_, i) => i !== blockIdx);
    newPages[pageIdx] = page;
    setSite({ ...site, pages: newPages });
  }, [site]);

  // Handle apply (save to DB)
  const handleApply = useCallback(async () => {
    setIsApplying(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/site?action=apply", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ site }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save site");
      }

      onApply(site);
    } catch (err: any) {
      setError(err.message || "Failed to apply site");
      setIsApplying(false);
    }
  }, [site, onApply]);

  const activePage = site.pages[activePageIdx];
  const totalBlocks = site.pages.reduce((s, p) => s + p.blocks.length, 0);

  return (
    <div className="fixed inset-0 z-9999 bg-black/60 flex items-center justify-center">
      <div className="bg-gray-50 w-[95vw] h-[92vh] max-w-350 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              ✨ Generated Site — {site.companyName}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {site.pages.length} pages · {totalBlocks} blocks · {creditsUsed + regenCredits} credits used
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || site.pages.length === 0}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isApplying ? "Saving…" : `✅ Apply ${site.pages.length} Pages`}
            </button>
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-xs ml-4">✕</button>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — page list */}
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pages</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {site.pages.map((page, idx) => (
                <button
                  key={page.slug}
                  onClick={() => setActivePageIdx(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    idx === activePageIdx
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{page.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">/{page.slug} · {page.blocks.length} blocks</div>
                    </div>
                    {idx === activePageIdx && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 ml-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Summary footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 leading-relaxed">{site.summary.slice(0, 150)}</p>
              {site.warnings.length > 0 && (
                <div className="mt-2">
                  {site.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600">⚠ {w}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main area — active page preview */}
          {activePage ? (
            <PagePreview
              page={activePage}
              pageIndex={activePageIdx}
              onRegeneratePage={handleRegeneratePage}
              onRemovePage={handleRemovePage}
              onRemoveBlock={handleRemoveBlock}
              isRegenerating={isRegenerating}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              No pages to preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
