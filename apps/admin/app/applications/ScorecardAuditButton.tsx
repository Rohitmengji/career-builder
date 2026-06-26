/*
 * ScorecardAuditButton (ADR-0026) — AI bias & consistency check for ONE scorecard.
 *
 * WHAT: a "Check for bias" button on each scorecard; on click it asks the AI linter
 *   to review the interviewer's own scores + comments and shows any fairness/quality
 *   flags inline.
 * WHY: nudges fairer, evidence-based evaluation BEFORE a decision — extends JD-bias
 *   detection (A6) to the evaluation itself. Internal-only; never candidate-visible.
 * HOW: POST /api/admin/applications/[id]/scorecards/audit { scorecardId }. Fail-soft:
 *   on an unavailable result (AI off/error) it shows a quiet "couldn't run" note. Only
 *   rendered when the ai_scorecard_audit flag is on.
 */
"use client";

import { useState } from "react";

interface Flag { type: string; severity: "low" | "medium" | "high"; excerpt: string; why: string; suggestion: string; }

const TYPE_LABEL: Record<string, string> = {
  biased_language: "Biased language",
  score_comment_mismatch: "Score / comment mismatch",
  vague: "Vague / no evidence",
  unprofessional: "Unprofessional",
};
const SEV_CLASS: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-gray-200 bg-gray-50 text-gray-700",
};

export default function ScorecardAuditButton({ applicationId, scorecardId, csrf }: { applicationId: string; scorecardId: string; csrf: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "unavailable">("idle");
  const [flags, setFlags] = useState<Flag[]>([]);

  async function run() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(applicationId)}/scorecards/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ scorecardId }),
      });
      if (!res.ok) { setState("unavailable"); return; }
      const d = await res.json();
      if (!d.available) { setState("unavailable"); return; }
      setFlags((d.flags ?? []) as Flag[]);
      setState("done");
    } catch { setState("unavailable"); }
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      {state === "idle" && (
        <button type="button" onClick={run} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          ✨ Check this evaluation for bias
        </button>
      )}
      {state === "loading" && <p className="text-xs text-gray-400">Reviewing the evaluation…</p>}
      {state === "unavailable" && <p className="text-xs text-gray-400">Bias check couldn&apos;t run right now.</p>}
      {state === "done" && (
        flags.length === 0 ? (
          <p className="text-xs text-emerald-700">✓ No bias or consistency issues detected — evidence-based and fair.</p>
        ) : (
          <ul className="space-y-1.5">
            {flags.map((f, i) => (
              <li key={i} className={`rounded-md border px-2 py-1.5 text-[11px] ${SEV_CLASS[f.severity] ?? SEV_CLASS.low}`}>
                <span className="font-semibold">{TYPE_LABEL[f.type] ?? f.type}</span>
                {f.excerpt && <span className="opacity-80"> — “{f.excerpt}”</span>}
                <p className="mt-0.5 opacity-90">{f.why}</p>
                <p className="mt-0.5 italic opacity-90">Try: {f.suggestion}</p>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
