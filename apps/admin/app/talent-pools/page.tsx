/*
 * Talent Pools — /talent-pools (ADR-0018, B3)
 *
 * WHAT: the recruiter CRM. List/create talent pools, view a pool's members, and send
 *   a consent-gated re-engagement email to a pool.
 * WHY: keep promising past candidates warm for future roles without spamming —
 *   re-engagement only reaches candidates who granted marketing consent (ADR-0011).
 * HOW: client component (useAuthGuard) over /api/admin/talent-pools[/[id]/members|reengage].
 *   Member identity is redacted by the API under blind hiring; the re-engage send
 *   happens server-side (the recruiter never sees recipient emails). Flag talent_pool.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { Card, Button, Skeleton, Alert, EmptyState } from "@/components/ui";
import { isEnabled } from "@career-builder/shared/feature-flags";

interface Pool { id: string; name: string; description: string | null; count: number; }
interface Member { id: string; name: string | null; email: string | null; note: string | null; createdAt: string; }

export default function TalentPoolsPage() {
  const { authenticated, loading: authLoading } = useAuthGuard();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrf, setCsrf] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Pool | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersBlind, setMembersBlind] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  const headers = { "Content-Type": "application/json", "x-csrf-token": csrf };

  const loadPools = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/talent-pools", { cache: "no-store" });
      if (!res.ok) { setError("Failed to load talent pools."); return; }
      const d = await res.json();
      setPools((d.pools ?? []) as Pool[]);
    } catch { setError("Failed to load talent pools."); } finally { setLoading(false); }
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
        const res = await fetch("/api/admin/talent-pools", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (active) { setPools((d.pools ?? []) as Pool[]); }
      } catch { /* ignore */ } finally { if (active) setLoading(false); }
    };
    void run();
    return () => { active = false; };
  }, [authenticated, authLoading]);

  const loadMembers = useCallback(async (pool: Pool) => {
    setSelected(pool);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/admin/talent-pools/${pool.id}/members`, { cache: "no-store" });
      if (!res.ok) { setMembers([]); return; }
      const d = await res.json();
      setMembers((d.members ?? []) as Member[]);
      setMembersBlind(Boolean(d.blindHiring));
    } catch { setMembers([]); } finally { setMembersLoading(false); }
  }, []);

  async function createPool(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError("");
    try {
      const res = await fetch("/api/admin/talent-pools", { method: "POST", headers, body: JSON.stringify({ name, description: newDesc.trim() || undefined }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not create pool"); return; }
      setNewName(""); setNewDesc("");
      await loadPools();
    } catch { setError("Could not create pool"); }
  }

  async function deletePool(pool: Pool) {
    if (!confirm(`Delete pool "${pool.name}" and its ${pool.count} member(s)?`)) return;
    try {
      const res = await fetch("/api/admin/talent-pools", { method: "DELETE", headers, body: JSON.stringify({ id: pool.id }) });
      if (res.ok) { if (selected?.id === pool.id) { setSelected(null); setMembers([]); } await loadPools(); }
    } catch { /* ignore */ }
  }

  async function removeMember(m: Member) {
    if (!selected || !m.email) return; // can't remove a redacted member from this view
    try {
      const res = await fetch(`/api/admin/talent-pools/${selected.id}/members`, { method: "DELETE", headers, body: JSON.stringify({ email: m.email }) });
      if (res.ok) { await loadMembers(selected); await loadPools(); }
    } catch { /* ignore */ }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-56" />
          <div className="mt-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Talent pools</h1>
            <p className="mt-1 text-sm text-gray-600">Keep promising past candidates warm. Re-engagement only reaches candidates who opted in.</p>
          </div>
          <div className="flex items-center gap-2">
            {isEnabled("nurture_email") && (
              <Link href="/campaigns" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Campaigns</Link>
            )}
            <Link href="/applications" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">← Applications</Link>
          </div>
        </div>

        {error && <Alert tone="error" className="mb-4">{error}</Alert>}

        {/* Create */}
        <Card className="mb-6">
          <form onSubmit={createPool} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="pool-name" className="mb-1 block text-xs font-medium text-gray-500">New pool</label>
              <input id="pool-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="e.g. Senior frontend — keep warm" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="pool-desc" className="mb-1 block text-xs font-medium text-gray-500">Description (optional)</label>
              <input id="pool-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={500} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
            <Button type="submit" disabled={!newName.trim()}>Create pool</Button>
          </form>
        </Card>

        {/* Pools */}
        {pools.length === 0 ? (
          <EmptyState title="No talent pools yet" body="Create a pool above, then add candidates from the applications list." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pools.map((p) => (
              <Card key={p.id} className={`cursor-pointer transition ${selected?.id === p.id ? "ring-2 ring-gray-900" : "hover:border-gray-300"}`}>
                <button type="button" onClick={() => loadMembers(p)} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">{p.name}</h2>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{p.count}</span>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-gray-600">{p.description}</p>}
                </button>
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={() => deletePool(p)} className="text-xs text-gray-400 hover:text-red-600">Delete</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Selected pool detail */}
        {selected && (
          <Card className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selected.name} — members</h2>
              <button type="button" onClick={() => { setSelected(null); setMembers([]); }} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
            </div>

            {membersBlind && (
              <Alert tone="info" className="mb-4">Blind hiring is on — member identities are hidden. Re-engagement still works (sent without revealing contact details).</Alert>
            )}

            <ReengageComposer poolId={selected.id} headers={headers} />

            {membersLoading ? (
              <Skeleton className="mt-4 h-24 w-full" />
            ) : members.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No members yet. Add candidates from the <Link href="/applications" className="underline">applications list</Link>.</p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-100">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{m.name ?? "Candidate"}</p>
                      {m.email && <p className="truncate text-xs text-gray-500">{m.email}</p>}
                      {m.note && <p className="mt-0.5 truncate text-xs text-gray-400">{m.note}</p>}
                    </div>
                    {m.email && <button type="button" onClick={() => removeMember(m)} className="shrink-0 text-xs text-gray-400 hover:text-red-600">Remove</button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Re-engage composer — consent-gated broadcast                       */
/* ------------------------------------------------------------------ */

function ReengageComposer({ poolId, headers }: { poolId: string; headers: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || busy) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch(`/api/admin/talent-pools/${poolId}/reengage`, { method: "POST", headers, body: JSON.stringify({ subject: subject.trim(), message: message.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setResult(d.error || "Send failed"); return; }
      setResult(`Sent ${d.sent} email(s). ${d.skippedNoConsent} skipped (no marketing consent).`);
      setSubject(""); setMessage("");
    } catch { setResult("Send failed"); } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-3">
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-gray-700 hover:text-gray-900">✉ Re-engage this pool…</button>
        {result && <p className="mt-2 text-sm text-gray-600">{result}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={send} className="rounded-lg border border-gray-200 p-3">
      <p className="mb-2 text-xs text-gray-500">Only candidates who granted marketing consent will receive this. Others are skipped automatically.</p>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Subject" className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} rows={4} placeholder="Your message…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" disabled={busy || !subject.trim() || !message.trim()}>{busy ? "Sending…" : "Send"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        {result && <span className="text-sm text-gray-600">{result}</span>}
      </div>
    </form>
  );
}
