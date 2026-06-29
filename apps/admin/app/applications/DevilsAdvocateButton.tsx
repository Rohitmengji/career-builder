/*
 * DevilsAdvocateButton (ADR-0032) — pre-decision counter-argument.
 *
 * WHAT: a "Challenge this decision" button on the decision-summary panel; on click an
 *   AI argues the STRONGEST evidence-based case for the OPPOSITE of where the panel is
 *   leaning (reject ↔ hire), grounded only in job requirements + the structured scores.
 * WHY: a structured antidote to confirmation bias — the team checks the other side
 *   before committing. Advisory; it never blocks a decision. Internal-only.
 * HOW: POST /api/admin/applications/[id]/devils-advocate. The server derives the decision
 *   being challenged from the recommendation lean (no PII leaves the server). Fail-soft:
 *   on an unavailable result it shows a quiet "couldn't run" note. Only rendered when the
 *   ai_devils_advocate flag is on.
 */
"use client";

import { useState } from "react";

interface CounterPoint { argument: string; basis: string; }
interface Result { available: boolean; proposedDecision: "reject" | "hire"; points: CounterPoint[]; caution: string; }

export default function DevilsAdvocateButton({ applicationId, csrf }: { applicationId: string; csrf: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "unavailable">("idle");
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(applicationId)}/devils-advocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({}),
      });
      if (!res.ok) { setState("unavailable"); return; }
      const d = (await res.json()) as Result;
      if (!d.available) { setState("unavailable"); return; }
      setResult(d);
      setState("done");
    } catch { setState("unavailable"); }
  }

  // The panel leans one way; we argue the opposite.
  const challenged = result?.proposedDecision === "hire" ? "hire" : "reject";
  const heading = challenged === "hire"
    ? "Before you hire — the case for caution"
    : "Before you reject — the case to reconsider";

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      {state === "idle" && (
        <button type="button" onClick={run} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded">
          ⚖️ Challenge this decision (devil&apos;s advocate)
        </button>
      )}
      {state === "loading" && <p className="text-xs text-gray-400">Building the strongest counter-case…</p>}
      {state === "unavailable" && <p className="text-xs text-gray-400">Couldn&apos;t build a counter-case right now.</p>}
      {state === "done" && result && (
        <div>
          <p className="text-xs font-semibold text-indigo-900">{heading}</p>
          {result.points.length === 0 ? (
            <p className="mt-1 text-[11px] text-gray-600">{result.caution || "The evidence largely supports the panel — little to argue for the other side."}</p>
          ) : (
            <>
              <ul className="mt-1.5 space-y-1.5">
                {result.points.map((p, i) => (
                  <li key={i} className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-[11px] text-indigo-900">
                    <p>{p.argument}</p>
                    <p className="mt-0.5 italic opacity-80">Basis: {p.basis}</p>
                  </li>
                ))}
              </ul>
              {result.caution && <p className="mt-1.5 text-[11px] italic text-gray-500">{result.caution}</p>}
            </>
          )}
          <p className="mt-1.5 text-[10px] text-gray-400">Advisory only — generated to counter confirmation bias. The decision is yours.</p>
        </div>
      )}
    </div>
  );
}
