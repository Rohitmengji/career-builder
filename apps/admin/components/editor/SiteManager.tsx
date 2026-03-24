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
  }, [newSlug, pages, onCreatePage]);

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
    [onDeletePage],
  );

  // Site URL for preview
  const siteUrl = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* Page list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading pages…</div>
        ) : pages.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-2xl mb-2">📄</div>
            <p className="text-xs text-gray-400">No pages yet</p>
            <p className="text-[10px] text-gray-300 mt-1">Click + to create your first page</p>
          </div>
        ) : (
          pages.map((page) => {
            const isActive = page.slug === activePage;
            return (
              <div
                key={page.slug}
                className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => handleSwitch(page.slug)}
              >
                {/* Page icon */}
                <div className={`text-sm shrink-0 ${isActive ? "opacity-100" : "opacity-50"}`}>
                  {page.slug === "careers" || page.slug === "home" ? "🏠" :
                   page.slug === "jobs" ? "💼" :
                   page.slug === "about" ? "🏢" :
                   page.slug === "culture" ? "🎯" :
                   page.slug === "benefits" ? "🎁" :
                   page.slug === "contact" ? "📞" :
                   page.slug === "team" ? "👥" : "📄"}
                </div>

                {/* Page info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{page.label}</div>
                  <div className="text-[10px] text-gray-400 truncate">/{page.slug}</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <a
                    href={`${siteUrl}/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 text-[10px]"
                    title="Preview live"
                  >
                    ↗
                  </a>
                  {!isActive && page.slug !== "careers" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(page.slug);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 text-[10px]"
                      title="Delete page"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add new page */}
      {showNewPage ? (
        <div className="px-3 py-3 border-t border-gray-100 bg-gray-50/80">
          <p className="text-[10px] font-medium text-gray-500 mb-1.5">New page slug</p>
          <div className="flex items-center gap-1.5">
            <input
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
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="px-2.5 py-1.5 text-[10px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
            >
              Add
            </button>
          </div>
          {error && (
            <p className="text-[10px] text-red-500 mt-1.5">{error}</p>
          )}
          <button
            onClick={() => { setShowNewPage(false); setNewSlug(""); setError(null); }}
            className="text-[10px] text-gray-400 hover:text-gray-600 mt-1.5"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={() => setShowNewPage(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
          >
            <span>+</span>
            <span>Add New Page</span>
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            {pages.length} page{pages.length !== 1 ? "s" : ""} in site
          </p>
        </div>
      )}
    </div>
  );
}
