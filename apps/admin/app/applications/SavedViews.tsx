/*
 * SavedViews (ADR-0016, B2b) — named, PRIVATE filter presets on the applications list.
 *
 * WHAT: a dropdown to apply / save / delete the caller's own saved filter views.
 * WHY: recruiters re-run the same filtered lists; this removes the repeated clicking.
 * HOW: GET/POST/DELETE /api/admin/saved-views (per-user scoped server-side). Saving
 *   captures the CURRENT filters (passed in via props); applying calls onApply with a
 *   view's stored filters. Renders nothing until the list has loaded (flag off → []).
 *   Native <details> popover (no outside-click effect). Self-pacing fetch uses the
 *   await-inside-inline-async pattern (React-19 set-state-in-effect rule).
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface ViewFilters {
  status?: string;
  jobId?: string;
  department?: string;
  q?: string;
  tags?: string[];
}

interface SavedView {
  id: string;
  name: string;
  filters: ViewFilters;
}

export default function SavedViews({
  current,
  csrf,
  onApply,
}: {
  current: ViewFilters;
  csrf: string;
  onApply: (filters: ViewFilters) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-csrf-token": csrf }), [csrf]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/saved-views", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      if (d?.enabled === false) return; // flag off → leave hidden
      setViews((d.views ?? []) as SavedView[]);
      setReady(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch("/api/admin/saved-views", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (d?.enabled === false) return;
        if (active) { setViews((d.views ?? []) as SavedView[]); setReady(true); }
      } catch { /* ignore */ }
    };
    void run();
    return () => { active = false; };
  }, []);

  const hasFilters = Boolean(current.status || current.q || current.jobId || current.department || (current.tags && current.tags.length));

  const save = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/saved-views", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: trimmed, filters: current }),
      });
      if (res.ok) { setName(""); await reload(); }
    } catch { /* ignore */ } finally { setBusy(false); }
  }, [name, busy, current, headers, reload]);

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/saved-views", { method: "DELETE", headers, body: JSON.stringify({ id }) });
      if (res.ok) await reload();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  if (!ready) return null;

  return (
    <details className="relative inline-block">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
        Saved views {views.length > 0 && <span className="text-gray-400">({views.length})</span>}
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
        {views.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-500">No saved views yet.</p>}
        {views.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
            <button type="button" onClick={() => onApply(v.filters)} className="min-w-0 flex-1 truncate text-left text-sm text-gray-800">
              {v.name}
            </button>
            <button type="button" onClick={() => remove(v.id)} aria-label={`Delete ${v.name}`} className="rounded px-1.5 text-xs text-gray-400 hover:text-red-600">✕</button>
          </div>
        ))}
        <form onSubmit={save} className="mt-2 flex items-center gap-1 border-t border-gray-100 pt-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={hasFilters ? "Save current filters as…" : "Apply a filter first"}
            disabled={!hasFilters}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none disabled:bg-gray-50"
          />
          <button type="submit" disabled={!hasFilters || !name.trim() || busy} className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40">Save</button>
        </form>
      </div>
    </details>
  );
}
