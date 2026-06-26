/*
 * DecisionLedgerPanel (ADR-0027) — the candidate's sealed decision receipt.
 *
 * WHAT: a collapsible "decision receipt" on a terminal application — the ordered,
 *   plain-language signals behind the decision (screening → status timeline → curated
 *   reason) + a tamper-evidence badge (sealed & unchanged / modified after your
 *   decision / not sealed) + a copyable receipt digest.
 * WHY: turns the hiring black box into something the candidate can see and trust —
 *   the capstone of the Candidate Trust Layer.
 * HOW: lazy-fetches GET /api/profile/decision-ledger?applicationId=… on expand (own
 *   data only, server-verified). Renders nothing if the flag is off (404) or there's
 *   no sealed ledger. React 19: await-inside-inline-async then setState.
 */
"use client";

import { useState } from "react";

interface Entry { kind: "screening" | "status" | "reason"; passed?: boolean; status?: string; category?: string; message?: string }
interface Ledger { entries: Entry[]; verdict: "verified" | "modified" | "unsealed"; sealedAt: string | null; digest: string }

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied", screening: "Under review", interview: "Interview", offer: "Offer", hired: "Hired", rejected: "Not selected",
};

const VERDICT: Record<string, { label: string; cls: string }> = {
  verified: { label: "✓ Sealed & unchanged", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  modified: { label: "⚠ Modified after your decision", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  unsealed: { label: "Not sealed", cls: "bg-gray-50 text-gray-600 border-gray-200" },
};

export default function DecisionLedgerPanel({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const [ledger, setLedger] = useState<Ledger | null>(null);

  async function load() {
    setOpen(true);
    if (state === "ready" || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch(`/api/profile/decision-ledger?applicationId=${encodeURIComponent(applicationId)}`, { cache: "no-store" });
      if (!res.ok) { setState("empty"); return; } // flag off / not found
      const d = await res.json();
      const l = (d.ledgers ?? [])[0] as Ledger | undefined;
      if (!l || l.entries.length === 0) { setState("empty"); return; }
      setLedger(l); setState("ready");
    } catch { setState("empty"); }
  }

  if (state === "empty") return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {!open ? (
        <button type="button" onClick={load} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          🧾 View decision receipt
        </button>
      ) : state === "loading" ? (
        <p className="text-xs text-gray-400">Loading your receipt…</p>
      ) : ledger ? (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">Decision receipt</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${VERDICT[ledger.verdict].cls}`}>{VERDICT[ledger.verdict].label}</span>
          </div>
          <ol className="space-y-1.5">
            {ledger.entries.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                <span>
                  {e.kind === "screening" && <>Screening — <strong>{e.passed ? "passed" : "not passed"}</strong></>}
                  {e.kind === "status" && <>Status: <strong>{STATUS_LABEL[e.status ?? ""] ?? e.status}</strong></>}
                  {e.kind === "reason" && <>Reason: {e.message}</>}
                </span>
              </li>
            ))}
          </ol>
          {ledger.verdict === "modified" && (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">This record was changed after your decision was finalized.</p>
          )}
          <p className="mt-2 break-all text-[10px] text-gray-400" title="Receipt digest">Receipt #{ledger.digest.slice(0, 16)}{ledger.sealedAt ? ` · sealed ${new Date(ledger.sealedAt).toLocaleDateString()}` : ""}</p>
        </div>
      ) : null}
    </div>
  );
}
