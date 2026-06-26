/*
 * Requisitions — /requisitions (ADR-0020, B6a)
 *
 * WHAT: raise headcount requisitions and move them through the approval workflow
 *   (draft → pending_approval → approved | rejected). A job can be published only
 *   once its requisition is approved (enforced server-side in the jobs route).
 * WHY: organizations gate job postings behind headcount sign-off.
 * HOW: client component (useAuthGuard) over /api/admin/requisitions. The state
 *   machine + RBAC live server-side (shared/requisition + the route); this page only
 *   offers the actions the current status allows. approve/reject are manager+ (the
 *   server enforces; the UI hides them for other roles). Flag req_approval.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { Card, Button, Badge, Skeleton, Alert, EmptyState } from "@/components/ui";

interface Requisition {
  id: string;
  title: string;
  department: string | null;
  headcount: number;
  justification: string | null;
  status: string;
  decisionNote: string | null;
  jobId: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "success",
  rejected: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export default function RequisitionsPage() {
  const { authenticated, loading: authLoading, user } = useAuthGuard();
  const canApprove = ["super_admin", "admin", "hiring_manager"].includes(user?.role ?? "");
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrf, setCsrf] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [headcount, setHeadcount] = useState("1");

  const headers = { "Content-Type": "application/json", "x-csrf-token": csrf };

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/requisitions", { cache: "no-store" });
      if (!res.ok) { setError("Failed to load requisitions."); return; }
      const d = await res.json();
      setReqs((d.requisitions ?? []) as Requisition[]);
    } catch { setError("Failed to load requisitions."); } finally { setLoading(false); }
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
        const res = await fetch("/api/admin/requisitions", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (active) setReqs((d.requisitions ?? []) as Requisition[]);
      } catch { /* ignore */ } finally { if (active) setLoading(false); }
    };
    void run();
    return () => { active = false; };
  }, [authenticated, authLoading]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/admin/requisitions", {
        method: "POST", headers,
        body: JSON.stringify({ title: title.trim(), department: department.trim() || undefined, headcount: Number(headcount) || 1 }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not create requisition"); return; }
      setTitle(""); setDepartment(""); setHeadcount("1");
      await reload();
    } catch { setError("Could not create requisition"); }
  }

  async function act(id: string, action: "submit" | "approve" | "reject" | "reopen") {
    setError("");
    let decisionNote: string | undefined;
    if (action === "reject") {
      decisionNote = window.prompt("Reason for rejecting (optional):") ?? undefined;
    }
    try {
      const res = await fetch("/api/admin/requisitions", { method: "PATCH", headers, body: JSON.stringify({ id, action, decisionNote }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Action failed"); return; }
      await reload();
    } catch { setError("Action failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this requisition?")) return;
    try {
      const res = await fetch("/api/admin/requisitions", { method: "DELETE", headers, body: JSON.stringify({ id }) });
      if (res.ok) await reload();
    } catch { /* ignore */ }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-56" />
          <div className="mt-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Requisitions</h1>
            <p className="mt-1 text-sm text-gray-600">Headcount sign-off — a role can be published only once its requisition is approved.</p>
          </div>
          <Link href="/jobs" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">← Jobs</Link>
        </div>

        {error && <Alert tone="error" className="mb-4">{error}</Alert>}

        <Card className="mb-6">
          <form onSubmit={create} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="req-title" className="mb-1 block text-xs font-medium text-gray-500">New requisition</label>
              <input id="req-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Senior Frontend Engineer" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
            <div className="w-40">
              <label htmlFor="req-dept" className="mb-1 block text-xs font-medium text-gray-500">Department</label>
              <input id="req-dept" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
            <div className="w-24">
              <label htmlFor="req-hc" className="mb-1 block text-xs font-medium text-gray-500">Headcount</label>
              <input id="req-hc" type="number" min={1} max={1000} value={headcount} onChange={(e) => setHeadcount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
            <Button type="submit" disabled={!title.trim()}>Raise</Button>
          </form>
        </Card>

        {reqs.length === 0 ? (
          <EmptyState title="No requisitions yet" body="Raise a requisition above to start the approval workflow." />
        ) : (
          <div className="space-y-3">
            {reqs.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{r.title}</h2>
                      <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-600">{r.department || "—"} · {r.headcount} headcount</p>
                    {r.justification && <p className="mt-1 text-sm text-gray-500">{r.justification}</p>}
                    {r.decisionNote && <p className="mt-1 text-sm text-gray-500"><span className="font-medium">Decision note:</span> {r.decisionNote}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.status === "draft" && <Button size="sm" onClick={() => act(r.id, "submit")}>Submit for approval</Button>}
                    {r.status === "pending_approval" && canApprove && (
                      <>
                        <Button size="sm" onClick={() => act(r.id, "approve")}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => act(r.id, "reject")}>Reject</Button>
                      </>
                    )}
                    {r.status === "pending_approval" && !canApprove && <span className="text-xs text-gray-400">Awaiting a hiring manager</span>}
                    {r.status === "rejected" && <Button size="sm" variant="secondary" onClick={() => act(r.id, "reopen")}>Reopen</Button>}
                    <button type="button" onClick={() => remove(r.id)} className="text-xs text-gray-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
