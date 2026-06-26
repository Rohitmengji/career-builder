/*
 * Nurture Campaigns — /campaigns (ADR-0019, B4)
 *
 * WHAT: build multi-step re-engagement sequences, enroll a talent pool, and
 *   activate them. The C1 cron sends each step on schedule — only to candidates with
 *   marketing consent (ADR-0011).
 * WHY: keep past candidates warm automatically without spamming.
 * HOW: client component (useAuthGuard) over /api/admin/campaigns[/[id]/steps|enroll].
 *   Status draft → active → paused. Flag nurture_email.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { Card, Button, Badge, Skeleton, Alert, EmptyState } from "@/components/ui";

interface Campaign { id: string; name: string; status: string; steps: number; enrollments: number; }
interface Step { id: string; stepIndex: number; offsetDays: number; subject: string; body: string; }
interface Pool { id: string; name: string; count: number; }

const TONE: Record<string, "neutral" | "success" | "warning"> = { draft: "neutral", active: "success", paused: "warning" };

export default function CampaignsPage() {
  const { authenticated, loading: authLoading } = useAuthGuard();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrf, setCsrf] = useState("");
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [sel, setSel] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  const headers = { "Content-Type": "application/json", "x-csrf-token": csrf };

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/campaigns", { cache: "no-store" });
      if (res.ok) { const d = await res.json(); setCampaigns((d.campaigns ?? []) as Campaign[]); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const c = document.cookie.split(";").find((x) => x.trim().startsWith("cb_csrf="));
    if (c) setCsrf(c.split("=")[1]);
  }, []);

  useEffect(() => {
    if (authLoading || !authenticated) return;
    let active = true;
    const run = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch("/api/admin/campaigns", { cache: "no-store" }),
          fetch("/api/admin/talent-pools", { cache: "no-store" }),
        ]);
        if (active && cRes.ok) { const d = await cRes.json(); setCampaigns((d.campaigns ?? []) as Campaign[]); }
        if (active && pRes.ok) { const d = await pRes.json(); setPools((d.pools ?? []) as Pool[]); }
      } catch { /* ignore */ } finally { if (active) setLoading(false); }
    };
    void run();
    return () => { active = false; };
  }, [authenticated, authLoading]);

  const loadSteps = useCallback(async (c: Campaign) => {
    setSel(c);
    try {
      const res = await fetch(`/api/admin/campaigns/${c.id}/steps`, { cache: "no-store" });
      if (res.ok) { const d = await res.json(); setSteps((d.steps ?? []) as Step[]); }
    } catch { setSteps([]); }
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/admin/campaigns", { method: "POST", headers, body: JSON.stringify({ name: newName.trim() }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not create"); return; }
      setNewName(""); await reload();
    } catch { setError("Could not create"); }
  }

  async function setStatus(c: Campaign, status: string) {
    try {
      const res = await fetch("/api/admin/campaigns", { method: "PATCH", headers, body: JSON.stringify({ id: c.id, status }) });
      if (res.ok) await reload();
    } catch { /* ignore */ }
  }

  async function del(c: Campaign) {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    try {
      const res = await fetch("/api/admin/campaigns", { method: "DELETE", headers, body: JSON.stringify({ id: c.id }) });
      if (res.ok) { if (sel?.id === c.id) { setSel(null); setSteps([]); } await reload(); }
    } catch { /* ignore */ }
  }

  if (authLoading || loading) {
    return <main className="min-h-screen bg-gray-50"><div className="mx-auto max-w-4xl px-4 py-8"><Skeleton className="h-8 w-56" /><div className="mt-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div></div></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Nurture campaigns</h1>
            <p className="mt-1 text-sm text-gray-600">Automated multi-step re-engagement. Steps send on schedule — only to candidates who opted in to marketing.</p>
          </div>
          <Link href="/talent-pools" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Talent pools</Link>
        </div>

        {error && <Alert tone="error" className="mb-4">{error}</Alert>}

        <Card className="mb-6">
          <form onSubmit={create} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="c-name" className="mb-1 block text-xs font-medium text-gray-500">New campaign</label>
              <input id="c-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} placeholder="e.g. Re-engage senior frontend" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
            <Button type="submit" disabled={!newName.trim()}>Create</Button>
          </form>
        </Card>

        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" body="Create a campaign, add steps, then enroll a talent pool." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => (
              <Card key={c.id} className={sel?.id === c.id ? "ring-2 ring-gray-900" : ""}>
                <button type="button" onClick={() => loadSteps(c)} className="block w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">{c.name}</h2>
                    <Badge tone={TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{c.steps} step{c.steps === 1 ? "" : "s"} · {c.enrollments} enrolled</p>
                </button>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {c.status !== "active" && <Button size="sm" onClick={() => setStatus(c, "active")} disabled={c.steps === 0}>Activate</Button>}
                  {c.status === "active" && <Button size="sm" variant="secondary" onClick={() => setStatus(c, "paused")}>Pause</Button>}
                  <button type="button" onClick={() => del(c)} className="text-xs text-gray-400 hover:text-red-600">Delete</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {sel && (
          <Card className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{sel.name}</h2>
              <button type="button" onClick={() => { setSel(null); setSteps([]); }} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
            </div>
            <StepEditor campaignId={sel.id} steps={steps} headers={headers} onChange={() => loadSteps(sel)} />
            <EnrollBox campaignId={sel.id} pools={pools} headers={headers} onEnrolled={reload} />
          </Card>
        )}
      </div>
    </main>
  );
}

function StepEditor({ campaignId, steps, headers, onChange }: { campaignId: string; steps: Step[]; headers: Record<string, string>; onChange: () => void }) {
  const [offsetDays, setOffsetDays] = useState("0");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !bodyText.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/steps`, { method: "POST", headers, body: JSON.stringify({ offsetDays: Number(offsetDays) || 0, subject: subject.trim(), body: bodyText.trim() }) });
      if (res.ok) { setSubject(""); setBodyText(""); setOffsetDays("0"); onChange(); }
    } finally { setBusy(false); }
  }
  async function remove(stepId: string) {
    const res = await fetch(`/api/admin/campaigns/${campaignId}/steps`, { method: "DELETE", headers, body: JSON.stringify({ stepId }) });
    if (res.ok) onChange();
  }

  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-gray-800">Steps</h3>
      <ol className="mb-3 space-y-2">
        {steps.length === 0 && <li className="text-sm text-gray-500">No steps yet — add the first message below.</li>}
        {steps.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">Day {s.offsetDays} after enrollment</p>
              <p className="truncate text-sm font-medium text-gray-900">{s.subject}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{s.body}</p>
            </div>
            <button type="button" onClick={() => remove(s.id)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Remove</button>
          </li>
        ))}
      </ol>
      <form onSubmit={add} className="rounded-lg border border-gray-200 p-3">
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor="off" className="text-xs font-medium text-gray-500">Send on day</label>
          <input id="off" type="number" min={0} max={365} value={offsetDays} onChange={(e) => setOffsetDays(e.target.value)} className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none" />
          <span className="text-xs text-gray-400">days after enrollment</span>
        </div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Subject" className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
        <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} maxLength={5000} rows={3} placeholder="Message…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
        <div className="mt-2"><Button type="submit" size="sm" disabled={busy || !subject.trim() || !bodyText.trim()}>Add step</Button></div>
      </form>
    </div>
  );
}

function EnrollBox({ campaignId, pools, headers, onEnrolled }: { campaignId: string; pools: Pool[]; headers: Record<string, string>; onEnrolled: () => void }) {
  const [poolId, setPoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function enroll() {
    if (!poolId || busy) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/enroll`, { method: "POST", headers, body: JSON.stringify({ poolId }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setResult(`Enrolled ${d.enrolled} of ${d.fromPool} pool member(s).`); onEnrolled(); }
      else setResult(d.error || "Enroll failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-800">Enroll an audience</h3>
      {pools.length === 0 ? (
        <p className="text-sm text-gray-500">No talent pools yet — create one to enroll its candidates.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none">
            <option value="">Select a talent pool…</option>
            {pools.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.count})</option>)}
          </select>
          <Button type="button" onClick={enroll} disabled={!poolId || busy}>Enroll</Button>
        </div>
      )}
      {result && <p className="mt-2 text-sm text-gray-600">{result}</p>}
    </div>
  );
}
