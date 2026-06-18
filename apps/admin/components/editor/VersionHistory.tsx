/*
 * VersionHistory — displays page version history with restore capability.
 *
 * Renders in the right sidebar when the user clicks "History" in the toolbar.
 * Shows a chronological list of page versions with metadata (who saved, when,
 * block count). Clicking "Restore" reverts to that version.
 *
 * Design: No local state duplication — fetches from API on open. Provides
 * callbacks for version restore so the parent (editor page) can reload canvas.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

export interface VersionEntry {
  id: string;
  version: number;
  title: string;
  savedBy: string | null;
  savedByEmail: string | null;
  createdAt: string;
  blockCount: number;
}

interface VersionHistoryProps {
  /** Current page slug */
  slug: string;
  /** Current page version (for highlighting "active") */
  currentVersion: number;
  /** Called when user restores a version — parent should reload canvas */
  onRestore: (version: number, blocks: Array<{ type: string; props: Record<string, unknown> }>) => void;
  /** Called when user wants to close the history panel */
  onClose: () => void;
  /** CSRF token for restore POST */
  csrfToken: string;
}

/** Read the CSRF cookie value */
function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
  return match ? match[1] : "";
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VersionHistory({
  slug,
  currentVersion,
  onRestore,
  onClose,
  csrfToken,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pages/versions?slug=${encodeURIComponent(slug)}&limit=30`,
      );
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setVersions(data.versions || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("[VersionHistory] Failed to fetch:", err);
      setError("Unable to load version history.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRestore = useCallback(
    async (version: number) => {
      if (restoring !== null) return;
      if (version === currentVersion) return;

      const confirmed = confirm(
        `Restore to version ${version}? This will replace the current page content and create a new version.`,
      );
      if (!confirmed) return;

      setRestoring(version);
      setError(null);

      try {
        const res = await fetch("/api/pages/versions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken || getCsrf(),
          },
          body: JSON.stringify({ slug, version }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Restore failed.");
          return;
        }

        // Notify parent to reload canvas with restored blocks
        onRestore(data.version, data.blocks || []);

        // Refresh version list
        await fetchVersions();
      } catch (err) {
        console.error("[VersionHistory] Restore error:", err);
        setError("Network error during restore.");
      } finally {
        setRestoring(null);
      }
    },
    [slug, currentVersion, csrfToken, onRestore, fetchVersions, restoring],
  );

  return (
    <section className="flex flex-col h-full" aria-label="Version history">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l3 2" />
          </svg>
          <h3 className="text-sm font-bold text-gray-900">Version History</h3>
          {total > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-medium">
              {total}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close version history"
          className="w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
            <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading version history…</span>
          </div>
        )}

        {error && (
          <div className="mx-3 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg" role="alert">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {!loading && versions.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </div>
            <p className="text-xs text-gray-700">No version history yet.</p>
            <p className="text-[10px] text-gray-500 mt-1">
              Versions are created automatically when you save.
            </p>
          </div>
        )}

        {!loading && versions.length > 0 && (
          <div className="py-2">
            {versions.map((v, idx) => {
              const isCurrent = v.version === currentVersion;
              return (
                <div
                  key={v.id}
                  className={`mx-2 mb-1.5 p-3 rounded-lg border transition-colors ${
                    isCurrent
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900">
                          v{v.version}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                            Current
                          </span>
                        )}
                        {idx === 0 && !isCurrent && (
                          <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {v.blockCount} block{v.blockCount !== 1 ? "s" : ""} ·{" "}
                        {formatTimeAgo(v.createdAt)}
                      </p>
                      {v.savedByEmail && (
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                          by {v.savedByEmail}
                        </p>
                      )}
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleRestore(v.version)}
                        disabled={restoring !== null}
                        aria-label={`Restore version ${v.version}`}
                        className={`shrink-0 px-2.5 py-1.5 text-[10px] font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                          restoring === v.version
                            ? "bg-blue-100 text-blue-500 cursor-wait"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                        }`}
                      >
                        {restoring === v.version ? "Restoring…" : "Restore"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50">
        <p className="text-[10px] text-gray-500 text-center">
          Up to 50 versions kept per page
        </p>
      </div>
    </section>
  );
}
