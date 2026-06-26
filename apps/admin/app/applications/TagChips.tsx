/*
 * TagChips (ADR-0016, B2b) — per-application tag display + inline add/remove.
 *
 * WHAT: renders an application's tag chips and a "＋" popover to toggle tags from the
 *   tenant library on/off this application.
 * WHY: recruiters tag candidates inline from the list/board without leaving the row.
 * HOW: mutates via POST/DELETE /api/admin/applications/[id]/tags (CSRF header), then
 *   updates LOCAL state optimistically (no full-list reload — snappy). Uses a native
 *   <details> element for the popover so there's no outside-click effect to manage.
 *   Colours come from the closed-palette class map (tagColors) — never raw CSS.
 */
"use client";

import { useState } from "react";
import { chipClass } from "./tagColors";

export interface Tag {
  id: string;
  label: string;
  color: string | null;
}

export default function TagChips({
  applicationId,
  tags,
  library,
  csrf,
  onLibraryStale,
}: {
  applicationId: string;
  tags: Tag[];
  library: Tag[];
  csrf: string;
  /** Called after a successful mutation so the parent can refresh usage counts. */
  onLibraryStale?: () => void;
}) {
  const [applied, setApplied] = useState<Tag[]>(tags);
  const [busy, setBusy] = useState<string | null>(null);
  const appliedIds = new Set(applied.map((t) => t.id));

  async function toggle(tag: Tag) {
    if (busy) return;
    const has = appliedIds.has(tag.id);
    setBusy(tag.id);
    // Optimistic update.
    setApplied((prev) => (has ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]));
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/tags`, {
        method: has ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ tagId: tag.id }),
      });
      if (!res.ok) throw new Error("tag mutation failed");
      onLibraryStale?.();
    } catch {
      // Roll back on failure.
      setApplied((prev) => (has ? [...prev, tag] : prev.filter((t) => t.id !== tag.id)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {applied.map((t) => (
        <span
          key={t.id}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${chipClass(t.color)}`}
        >
          {t.label}
        </span>
      ))}

      {library.length > 0 && (
        <details className="relative inline-block">
          <summary
            className="flex cursor-pointer list-none items-center rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
            aria-label="Add or remove tags"
          >
            ＋ tag
          </summary>
          <div className="absolute left-0 z-20 mt-1 max-h-60 w-48 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            {library.map((t) => {
              const on = appliedIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t)}
                  disabled={busy === t.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"}`}>
                    {on ? "✓" : ""}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${chipClass(t.color)}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
