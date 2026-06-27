/*
 * PortableRecordButton (ADR-0030) — recruiter view of a candidate's VERIFIED track record.
 *
 * WHAT: a button that, when the candidate has opted in, shows their verified
 *   cross-platform footprint — COUNTS only (applications / interviews / offers / hires
 *   across N employers, never which).
 * WHY: a candidate-granted trust signal no ATS surfaces.
 * HOW: GET /api/admin/applications/[id]/portable-record (the server enforces the consent
 *   grant + tenant/team scope). Shows nothing actionable if the candidate hasn't shared.
 *   Only rendered when the portable_record flag is on.
 */
"use client";

import { useState } from "react";

interface Footprint { employers: number; applications: number; reachedInterview: number; offers: number; hired: number }

export default function PortableRecordButton({ applicationId }: { applicationId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "shown" | "not_shared">("idle");
  const [fp, setFp] = useState<Footprint | null>(null);

  async function load() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(applicationId)}/portable-record`, { cache: "no-store" });
      if (!res.ok) { setState("not_shared"); return; }
      const d = await res.json();
      if (!d.shared || !d.footprint) { setState("not_shared"); return; }
      setFp(d.footprint as Footprint);
      setState("shown");
    } catch { setState("not_shared"); }
  }

  if (state === "idle") {
    return (
      <button type="button" onClick={load} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        ✓ Verified record
      </button>
    );
  }
  if (state === "loading") return <span className="px-2 text-xs text-gray-400">Checking…</span>;
  if (state === "not_shared") return <span className="px-2 text-xs text-gray-400">Not shared</span>;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-800" title="Verified by the platform; shared by the candidate">
      <span className="font-semibold">Verified:</span>
      <span>{fp!.applications} applications</span>·
      <span>{fp!.employers} employers</span>·
      <span>{fp!.reachedInterview} interviews</span>·
      <span>{fp!.offers} offers</span>
      {fp!.hired > 0 && <>·<span>{fp!.hired} hired</span></>}
    </span>
  );
}
