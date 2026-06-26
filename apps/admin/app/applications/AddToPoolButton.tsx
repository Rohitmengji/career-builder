/*
 * AddToPoolButton (ADR-0018, B3) — add a candidate to a talent pool from a row.
 *
 * WHAT: a small "＋ pool" popover listing the tenant's talent pools; clicking one
 *   adds this application's candidate to it.
 * WHY: the natural place to start a CRM relationship is while looking at a candidate.
 * HOW: lazy-loads pools on first open (GET /api/admin/talent-pools), adds via
 *   POST /api/admin/talent-pools/[id]/members { applicationId } (the server resolves
 *   the email from the tenant-scoped application — the client never sends it). Native
 *   <details> popover (no outside-click effect).
 */
"use client";

import { useState } from "react";

interface Pool { id: string; name: string; count: number; }

export default function AddToPoolButton({ applicationId, csrf }: { applicationId: string; csrf: string }) {
  const [pools, setPools] = useState<Pool[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function ensurePools() {
    if (pools) return;
    try {
      const res = await fetch("/api/admin/talent-pools", { cache: "no-store" });
      if (!res.ok) { setPools([]); return; }
      const d = await res.json();
      setPools((d.pools ?? []) as Pool[]);
    } catch { setPools([]); }
  }

  async function add(poolId: string) {
    if (busy) return;
    setBusy(poolId);
    try {
      const res = await fetch(`/api/admin/talent-pools/${poolId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ applicationId }),
      });
      if (res.ok) setDone((prev) => new Set(prev).add(poolId));
    } catch { /* ignore */ } finally { setBusy(null); }
  }

  return (
    <details className="relative inline-block" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) void ensurePools(); }}>
      <summary className="flex cursor-pointer list-none items-center rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700" aria-label="Add to talent pool">
        ＋ pool
      </summary>
      <div className="absolute right-0 z-20 mt-1 max-h-60 w-56 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
        {pools === null && <p className="px-2 py-1.5 text-xs text-gray-400">Loading…</p>}
        {pools && pools.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-500">No pools yet — create one in Talent pools.</p>}
        {pools?.map((p) => {
          const added = done.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p.id)}
              disabled={busy === p.id || added}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-60"
            >
              <span className="truncate text-gray-800">{p.name}</span>
              <span className="shrink-0 text-gray-400">{added ? "✓ added" : "+"}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}
