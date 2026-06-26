"use client";

/*
 * /pipeline — per-tenant pipeline stage editor (ADR-0015, B1b).
 * Add custom stages, rename, reorder, and activate/deactivate. `Application.status`
 * stays canonical; a stage's `kind` maps to it. Gated by `custom_pipeline_stages`.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthGuard } from "@/lib/useAuthGuard";

interface Stage {
  id: string;
  key: string;
  label: string;
  kind: string;
  order: number;
  color: string | null;
  isActive: boolean;
  isTerminal: boolean;
}

const KINDS = [
  { value: "in_process", label: "In process (screening/interview)" },
  { value: "custom", label: "Custom (mid-funnel)" },
  { value: "offer", label: "Offer" },
];
const KIND_BADGE: Record<string, string> = {
  applied: "bg-gray-100 text-gray-700", in_process: "bg-blue-50 text-blue-700",
  offer: "bg-indigo-50 text-indigo-700", hired: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800", custom: "bg-purple-50 text-purple-700",
};

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const c = document.cookie.split(";").find((x) => x.trim().startsWith("cb_csrf="));
  return c ? c.split("=")[1] : "";
}

export default function PipelinePage() {
  const { authenticated, loading: authLoading } = useAuthGuard();
  const [stages, setStages] = useState<Stage[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState("in_process");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pipeline-stages", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setEnabled(d.enabled !== false);
        setStages(d.stages || []);
      }
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (authenticated && !authLoading) void load(); }, [authenticated, authLoading, load]);

  const patch = useCallback(async (body: object) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pipeline-stages", {
        method: "PATCH", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify(body),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Action failed."); return false; }
      return true;
    } catch { setError("Network error."); return false; } finally { setBusy(false); }
  }, []);

  const addStage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !newLabel.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pipeline-stages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() },
        body: JSON.stringify({ label: newLabel.trim(), kind: newKind }),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "Couldn't add stage."); return; }
      setNewLabel("");
      await load();
    } catch { setError("Network error."); } finally { setBusy(false); }
  }, [busy, newLabel, newKind, load]);

  const move = useCallback(async (idx: number, dir: -1 | 1) => {
    const next = [...stages];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setStages(next);
    if (await patch({ action: "reorder", orderedIds: next.map((s) => s.id) })) void load();
  }, [stages, patch, load]);

  const toggle = useCallback(async (s: Stage) => {
    if (await patch({ action: "update", id: s.id, isActive: !s.isActive })) void load();
  }, [patch, load]);

  if (authLoading || loading) {
    return <main className="min-h-screen bg-gray-50"><div className="mx-auto max-w-3xl px-4 py-10 text-sm text-gray-500">Loading…</div></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pipeline stages</h1>
        <p className="mt-1 text-sm text-gray-600">Customize the stages applications move through. The candidate-facing status stays standard.</p>

        {!enabled && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Custom pipeline stages aren&apos;t enabled for this workspace.
          </div>
        )}

        {enabled && (
          <>
            <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {stages.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-3 px-4 py-3 ${s.isActive ? "" : "opacity-50"}`}>
                  <div className="flex flex-col">
                    <button type="button" aria-label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">▲</button>
                    <button type="button" aria-label="Move down" disabled={busy || i === stages.length - 1} onClick={() => move(i, 1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">▼</button>
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-900">{s.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE[s.kind] ?? "bg-gray-100 text-gray-700"}`}>{s.kind.replace("_", " ")}</span>
                  <button type="button" onClick={() => toggle(s)} disabled={busy} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">
                    {s.isActive ? "Disable" : "Enable"}
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={addStage} className="mt-5 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
              <label className="flex-1 text-xs font-medium text-gray-600">New stage
                <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={60} placeholder="e.g. Take-home assignment"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
              </label>
              <label className="text-xs font-medium text-gray-600">Kind
                <select value={newKind} onChange={(e) => setNewKind(e.target.value)} className="mt-1 block rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm">
                  {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </label>
              <button type="submit" disabled={busy || !newLabel.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Add stage</button>
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
