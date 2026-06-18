/**
 * SiteManager — Multi-page site management panel.
 *
 * Shows all saved pages for the current tenant, lets the user:
 *   - Switch between pages (loads into GrapesJS canvas)
 *   - Create new blank pages
 *   - Delete pages
 *   - See which page is currently being edited
 *   - Quick-preview any page
 */
"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Inline page icons (decorative — aria-hidden) ─────────────────── */
const SVG = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};
function PageIcon({ slug, className = "h-4 w-4" }: { slug: string; className?: string }) {
  if (slug === "careers" || slug === "home")
    return <svg className={className} {...SVG}><path d="M3 11l9-7 9 7M5 10v10h14V10" /></svg>;
  if (slug === "jobs")
    return <svg className={className} {...SVG}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
  if (slug === "about")
    return <svg className={className} {...SVG}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h2M9 12h2M9 16h2M14 8h1M14 12h1M14 16h1" /></svg>;
  if (slug === "culture")
    return <svg className={className} {...SVG}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
  if (slug === "benefits")
    return <svg className={className} {...SVG}><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M3 12h18M12 8v13M12 8a3 3 0 1 0-3-3" /></svg>;
  if (slug === "contact")
    return <svg className={className} {...SVG}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" /></svg>;
  if (slug === "team")
    return <svg className={className} {...SVG}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
  return <svg className={className} {...SVG}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
}

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface PageEntry {
  slug: string;
  label: string;
  blockCount?: number;
}

const PAGE_LABELS: Record<string, string> = {
  careers: "Home / Careers",
  home: "Home / Careers",
  jobs: "Job Listings",
  about: "About Us",
  culture: "Culture & Values",
  benefits: "Benefits & Perks",
  contact: "Contact",
  team: "Our Team",
};

function labelForSlug(slug: string): string {
  return PAGE_LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

interface SiteManagerProps {
  /** Currently active page slug in editor */
  activePage: string;
  /** Called when user wants to switch to a different page */
  onSwitchPage: (slug: string) => void;
  /** Called when user creates a new blank page */
  onCreatePage: (slug: string) => void;
  /** Called when user deletes a page */
  onDeletePage: (slug: string) => void;
  /** Whether the editor has unsaved changes */
  hasUnsaved?: boolean;
  /** Increment this counter to force a page list refresh (e.g. after site apply) */
  refreshKey?: number;
  /** Called when page list changes (for parent badge display) */
  onPageCountChange?: (count: number) => void;
}

export default function SiteManager({
  activePage,
  onSwitchPage,
  onCreatePage,
  onDeletePage,
  hasUnsaved,
  refreshKey,
  onPageCountChange,
}: SiteManagerProps) {
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load page list from server
  const refreshPages = useCallback(async () => {
    try {
      const res = await fetch("/api/pages");
      const data = await res.json();
      let slugs: string[] = data.pages || [];
      // Ensure "careers" always appears (it's the default page)
      if (!slugs.includes("careers")) {
        slugs = ["careers", ...slugs];
      }
      setPages(
        slugs.map((slug) => ({
          slug,
          label: labelForSlug(slug),
        })),
      );
      onPageCountChange?.(slugs.length);
    } catch {
      // Fallback: at least show the active page
      setPages([{ slug: activePage, label: labelForSlug(activePage) }]);
    } finally {
      setLoading(false);
    }
  }, [activePage, onPageCountChange]);

  useEffect(() => {
    refreshPages();
  }, [refreshPages, refreshKey]);

  // Handle page switch
  const handleSwitch = useCallback(
    (slug: string) => {
      if (slug === activePage) return;
      if (hasUnsaved) {
        if (!confirm("You have unsaved changes. Switch page anyway?")) return;
      }
      onSwitchPage(slug);
    },
    [activePage, hasUnsaved, onSwitchPage],
  );

  // Handle new page creation
  const handleCreate = useCallback(() => {
    const slug = newSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) {
      setError("Please enter a valid page name");
      return;
    }
    if (pages.some((p) => p.slug === slug)) {
      setError(`Page "${slug}" already exists`);
      return;
    }

    setShowNewPage(false);
    setNewSlug("");
    setError(null);

    // Add to local list immediately
    setPages((prev) => {
      const updated = [...prev, { slug, label: labelForSlug(slug) }];
      onPageCountChange?.(updated.length);
      return updated;
    });
    onCreatePage(slug);
  }, [newSlug, pages, onCreatePage, onPageCountChange]);

  // Handle page deletion
  const handleDelete = useCallback(
    (slug: string) => {
      const label = labelForSlug(slug);
      if (!confirm(`Delete the "${label}" page? This cannot be undone.`)) return;
      setPages((prev) => {
        const updated = prev.filter((p) => p.slug !== slug);
        onPageCountChange?.(updated.length);
        return updated;
      });
      onDeletePage(slug);
    },
    [onDeletePage, onPageCountChange],
  );

  // Site URL for preview
  const siteUrl = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* Page list */}
      <ul className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading ? (
          <li className="py-8 text-center text-xs text-gray-600" role="status" aria-live="polite">Loading pages…</li>
        ) : pages.length === 0 ? (
          <li className="py-8 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500" aria-hidden="true">
              <PageIcon slug="" className="h-5 w-5" />
            </div>
            <p className="text-xs text-gray-700">No pages yet</p>
            <p className="text-[10px] text-gray-500 mt-1">Click + to create your first page</p>
          </li>
        ) : (
          pages.map((page) => {
            const isActive = page.slug === activePage;
            return (
              <li key={page.slug}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex items-center gap-2.5 px-3 py-2.5 min-h-11 rounded-lg cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => handleSwitch(page.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSwitch(page.slug); }
                  }}
                >
                  {/* Page icon */}
                  <span className={`shrink-0 ${isActive ? "text-blue-600" : "text-gray-500"}`} aria-hidden="true">
                    <PageIcon slug={page.slug} />
                  </span>

                  {/* Page info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{page.label}</div>
                    <div className="text-[10px] text-gray-500 truncate">/{page.slug}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                    <a
                      href={`${siteUrl}/${page.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Preview ${page.label} live in a new tab`}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      title="Preview live"
                    >
                      <svg className="h-3.5 w-3.5" {...SVG}><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                    </a>
                    {!isActive && page.slug !== "careers" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(page.slug);
                        }}
                        aria-label={`Delete ${page.label} page`}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        title="Delete page"
                      >
                        <svg className="h-3.5 w-3.5" {...SVG}><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Add new page */}
      {showNewPage ? (
        <div className="px-3 py-3 border-t border-gray-200 bg-gray-50/80">
          <label htmlFor="new-page-slug" className="block text-[10px] font-medium text-gray-600 mb-1.5">New page slug</label>
          <div className="flex items-center gap-1.5">
            <input
              id="new-page-slug"
              type="text"
              value={newSlug}
              onChange={(e) => {
                setNewSlug(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setShowNewPage(false);
                  setNewSlug("");
                  setError(null);
                }
              }}
              placeholder="e.g. team, faq"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "new-page-error" : undefined}
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-md placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600"
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-[11px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-600"
            >
              Add
            </button>
          </div>
          {error && (
            <p id="new-page-error" className="text-[10px] text-red-700 mt-1.5" role="alert">{error}</p>
          )}
          <button
            onClick={() => { setShowNewPage(false); setNewSlug(""); setError(null); }}
            className="rounded text-[10px] text-gray-600 hover:text-gray-900 mt-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="px-3 py-3 border-t border-gray-200">
          <button
            onClick={() => setShowNewPage(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <svg className="h-3.5 w-3.5" {...SVG}><path d="M12 5v14M5 12h14" /></svg>
            <span>Add New Page</span>
          </button>
          <p className="text-[10px] text-gray-500 text-center mt-2">
            {pages.length} page{pages.length !== 1 ? "s" : ""} in site
          </p>
        </div>
      )}
    </div>
  );
}
