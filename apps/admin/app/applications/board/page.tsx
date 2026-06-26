"use client";

/*
 * /applications/board — kanban pipeline board (ADR-0016, B2).
 * Columns = the tenant's pipeline stages (custom_pipeline_stages on) or the 6
 * canonical statuses. Drag a card to a column to move it — that's the same
 * tenant-scoped, side-effecting PATCH the list view uses (status_change event +
 * candidate email come free). Blind-hiring-aware (the API redacts the cards).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";

interface Application {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  stageId: string | null;
  job: { title: string; department: string };
}
interface Column { id: string; label: string; kind?: string }

const STATUS_COLUMNS: Column[] = [
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Under Review" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Not Selected" },
];

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const c = document.cookie.split(";").find((x) => x.trim().startsWith("cb_csrf="));
  return c ? c.split("=")[1] : "";
}

export default function ApplicationsBoardPage() {
  const { authenticated, loading: authLoading } = useAuthGuard();
  const [apps, setApps] = useState<Application[]>([]);
  const [stageColumns, setStageColumns] = useState<Column[] | null>(null); // null until stages resolve
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const usingStages = stageColumns !== null && stageColumns.length > 0;
  const columns = usingStages ? (stageColumns as Column[]) : STATUS_COLUMNS;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        fetch("/api/admin/applications?perPage=100", { cache: "no-store" }),
        fetch("/api/admin/pipeline-stages", { cache: "no-store" }),
      ]);
      if (aRes.ok) setApps((await aRes.json()).applications || []);
      if (sRes.ok) {
        const d = await sRes.json();
        setStageColumns(d.enabled ? (d.stages || []).filter((s: { isActive: boolean }) => s.isActive).map((s: { id: string; label: string; kind: string }) => ({ id: s.id, label: s.label, kind: s.kind })) : []);
      } else {
        setStageColumns([]);
      }
    } catch {
      /* keep */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authenticated && !authLoading) void load(); }, [authenticated, authLoading, load]);

  const colKey = useCallback((a: Application) => (usingStages ? a.stageId ?? "" : a.status), [usingStages]);

  const moveTo = useCallback(async (appId: string, columnId: string) => {
    const app = apps.find((a) => a.id === appId);
    if (!app || colKey(app) === columnId) return;
    // Optimistic: reflect the move immediately.
    setApps((prev) => prev.map((a) => (a.id === appId ? (usingStages ? { ...a, stageId: columnId } : { ...a, status: columnId }) : a)));
    try {
      const body = usingStages ? { id: appId, stageId: columnId } : { id: appId, status: columnId };
      const res = await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() },
        body: JSON.stringify(body),
      });
      if (!res.ok) { void load(); return; } // revert via reload on failure
      void load(); // resync derived status (stage moves change status too)
    } catch {
      void load();
    }
  }, [apps, colKey, usingStages, load]);

  if (authLoading || loading) {
    return <main className="min-h-screen bg-gray-50"><div className="mx-auto max-w-7xl px-4 py-10 text-sm text-gray-500">Loading board…</div></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pipeline board</h1>
            <p className="mt-1 text-sm text-gray-600">Drag a candidate to move them through the pipeline.</p>
          </div>
          <Link href="/applications" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">List view</Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const cards = apps.filter((a) => colKey(a) === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
                onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => { e.preventDefault(); setOverCol(null); if (dragId) void moveTo(dragId, col.id); setDragId(null); }}
                className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 ${overCol === col.id ? "border-blue-400 bg-blue-50/50" : "border-gray-200 bg-gray-100/60"}`}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-gray-800">{col.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-500">{cards.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {cards.map((a) => (
                    <article
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-gray-300 active:cursor-grabbing ${dragId === a.id ? "opacity-50" : ""}`}
                    >
                      <p className="text-sm font-medium text-gray-900">{a.firstName} {a.lastName}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{a.job.title}</p>
                    </article>
                  ))}
                  {cards.length === 0 && <p className="px-1 py-4 text-center text-xs text-gray-400">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
