"use client";

/*
 * ScorecardsDialog — structured interview scorecards for one application (ADR-0007).
 * Recruiter-facing: an aggregated decision panel + each interviewer's scorecard +
 * a form to submit/replace YOUR OWN scorecard. Scorecards are internal-only.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Spinner, XIcon } from "@/components/ui";
import { isEnabled } from "@career-builder/shared/feature-flags";
import ScorecardAuditButton from "./ScorecardAuditButton";
import DevilsAdvocateButton from "./DevilsAdvocateButton";

type Recommendation = "strong_yes" | "yes" | "no" | "strong_no";

interface Rating {
  criterion: string;
  score: number;
  comment: string | null;
}
interface Scorecard {
  id: string;
  interviewerId: string;
  interviewerName: string;
  recommendation: Recommendation;
  overallNotes: string | null;
  submittedAt: string;
  ratings: Rating[];
  coverage?: { total: number; withEvidence: number; missing: number; extremesMissing: number; adequate: boolean } | null;
}
interface Aggregate {
  total: number;
  overallAverage: number | null;
  perCriterion: { criterion: string; average: number | null; count: number }[];
  recommendationCounts: Record<Recommendation, number>;
  recommendationLean: number | null;
  needsMoreFeedback: boolean;
}
interface Payload {
  rubric: string[];
  scorecards: Scorecard[];
  aggregate: Aggregate;
  mySubmissionId: string | null;
  feedbackReleased?: boolean;
  feedbackEnabled?: boolean;
}

interface Props {
  applicationId: string;
  candidateName: string;
  csrf: string;
  onClose: () => void;
}

const REC_OPTIONS: { value: Recommendation; label: string }[] = [
  { value: "strong_yes", label: "Strong yes" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "strong_no", label: "Strong no" },
];
const REC_LABEL: Record<Recommendation, string> = {
  strong_yes: "Strong yes",
  yes: "Yes",
  no: "No",
  strong_no: "Strong no",
};
const REC_CLASS: Record<Recommendation, string> = {
  strong_yes: "bg-green-100 text-green-800",
  yes: "bg-emerald-50 text-emerald-700",
  no: "bg-amber-50 text-amber-700",
  strong_no: "bg-red-100 text-red-800",
};

export default function ScorecardsDialog({ applicationId, candidateName, csrf, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state (the caller's own scorecard).
  const [recommendation, setRecommendation] = useState<Recommendation>("yes");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [overallNotes, setOverallNotes] = useState("");
  const [releaseBusy, setReleaseBusy] = useState(false);

  const base = `/api/admin/applications/${encodeURIComponent(applicationId)}/scorecards`;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (res.status === 404) { setError("Scorecards aren't enabled for this workspace."); return; }
      if (!res.ok) throw new Error("load");
      const payload: Payload = await res.json();
      setData(payload);
      // Pre-fill the form from my existing scorecard, if any.
      const mine = payload.scorecards.find((sc) => sc.id === payload.mySubmissionId);
      if (mine) {
        setRecommendation(mine.recommendation);
        setOverallNotes(mine.overallNotes || "");
        const map: Record<string, number> = {};
        mine.ratings.forEach((r) => { map[r.criterion] = r.score; });
        setScores(map);
      }
    } catch {
      setError("Unable to load scorecards. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    dialogRef.current?.showModal();
    void load();
  }, [load]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  const toggleRelease = useCallback(async () => {
    if (releaseBusy || !data) return;
    setReleaseBusy(true);
    try {
      const action = data.feedbackReleased ? "unrelease" : "release";
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setData((d) => (d ? { ...d, feedbackReleased: !d.feedbackReleased } : d));
    } catch {
      /* keep current */
    } finally {
      setReleaseBusy(false);
    }
  }, [releaseBusy, data, base, csrf]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving || !data) return;
      setSaving(true);
      setError("");
      try {
        const ratings = data.rubric
          .filter((c) => typeof scores[c] === "number")
          .map((c) => ({ criterion: c, score: scores[c] }));
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({
            applicationId,
            recommendation,
            ratings,
            ...(overallNotes.trim() ? { overallNotes: overallNotes.trim() } : {}),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { setError(body.error || "Couldn't save your scorecard."); return; }
        await load(); // refresh list + aggregate (handles add vs replace cleanly)
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [saving, data, base, csrf, applicationId, recommendation, scores, overallNotes, load],
  );

  const fmtDate = (iso: string) => {
    try { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso)); }
    catch { return ""; }
  };

  const agg = data?.aggregate;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      aria-labelledby={headingId}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 open:flex open:items-center open:justify-center"
    >
      <div className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div>
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">Scorecards</h2>
            <p className="mt-0.5 text-sm text-gray-600">{candidateName}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close scorecards"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-blue-600"><Spinner /><span className="sr-only">Loading…</span></div>
          ) : error && !data ? (
            <p role="alert" className="py-6 text-center text-sm text-gray-600">{error}</p>
          ) : data ? (
            <>
              {/* Aggregated decision panel */}
              {agg && agg.total > 0 && (
                <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Decision summary</p>
                    <span className="text-xs text-gray-500">{agg.total} scorecard{agg.total === 1 ? "" : "s"}</span>
                  </div>
                  {agg.needsMoreFeedback && (
                    <p className="mt-1 text-xs font-medium text-amber-700">Needs more feedback before deciding.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {REC_OPTIONS.map((o) => agg.recommendationCounts[o.value] > 0 && (
                      <span key={o.value} className={`rounded-full px-2 py-0.5 text-xs font-medium ${REC_CLASS[o.value]}`}>
                        {o.label}: {agg.recommendationCounts[o.value]}
                      </span>
                    ))}
                  </div>
                  {agg.overallAverage !== null && (
                    <p className="mt-3 text-xs text-gray-600">Overall average score: <span className="font-semibold text-gray-900">{agg.overallAverage}</span> / 5</p>
                  )}
                  {agg.perCriterion.some((c) => c.average !== null) && (
                    <ul className="mt-2 space-y-1">
                      {agg.perCriterion.map((c) => (
                        <li key={c.criterion} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{c.criterion}</span>
                          <span className="font-medium text-gray-900">{c.average === null ? "—" : `${c.average} / 5`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isEnabled("ai_devils_advocate") && (
                    <DevilsAdvocateButton applicationId={applicationId} csrf={csrf} />
                  )}
                  {data.feedbackEnabled && (
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <button type="button" onClick={toggleRelease} disabled={releaseBusy}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                        {data.feedbackReleased ? "Hide feedback from candidate" : "Release anonymized feedback to candidate"}
                      </button>
                      {data.feedbackReleased && (
                        <p className="mt-1 text-[11px] text-emerald-700">Shared with the candidate — per-criterion averages only (no names, notes, or recommendations).</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submitted scorecards */}
              {data.scorecards.length > 0 && (
                <ul className="mb-5 space-y-3">
                  {data.scorecards.map((sc) => (
                    <li key={sc.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {sc.interviewerName}
                            {sc.id === data.mySubmissionId && <span className="ml-1 text-xs font-normal text-gray-400">(you)</span>}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">{fmtDate(sc.submittedAt)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REC_CLASS[sc.recommendation]}`}>
                          {REC_LABEL[sc.recommendation]}
                        </span>
                      </div>
                      {sc.ratings.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {sc.ratings.map((r) => (
                            <li key={r.criterion} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{r.criterion}</span>
                              <span className="font-medium text-gray-900">{r.score} / 5</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {sc.overallNotes && <p className="mt-2 whitespace-pre-wrap text-xs text-gray-600">{sc.overallNotes}</p>}
                      {sc.coverage && sc.coverage.total > 0 && (
                        <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${sc.coverage.adequate ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                          {sc.coverage.adequate ? "✓" : "⚠"} Evidence: {sc.coverage.withEvidence}/{sc.coverage.total} criteria
                          {sc.coverage.extremesMissing > 0 && <span> · {sc.coverage.extremesMissing} extreme score{sc.coverage.extremesMissing === 1 ? "" : "s"} unjustified</span>}
                        </p>
                      )}
                      {isEnabled("ai_scorecard_audit") && (
                        <ScorecardAuditButton applicationId={applicationId} scorecardId={sc.id} csrf={csrf} />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* My scorecard form */}
              <form onSubmit={submit} className="space-y-3 border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-900">
                  {data.mySubmissionId ? "Update your scorecard" : "Add your scorecard"}
                </p>

                {data.rubric.length === 0 ? (
                  <p className="text-xs text-gray-500">No rubric defined for this job. Add scorecard criteria in the job editor to score specific areas — you can still leave an overall recommendation.</p>
                ) : (
                  <div className="space-y-2">
                    {data.rubric.map((c) => (
                      <div key={c} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-xs font-medium text-gray-700">{c}</span>
                        <div className="flex shrink-0 gap-1" role="group" aria-label={`${c} score`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setScores((s) => ({ ...s, [c]: n }))}
                              aria-pressed={scores[c] === n}
                              className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                scores[c] === n ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <label className="block text-xs font-medium text-gray-600">Overall recommendation
                  <select value={recommendation} onChange={(e) => setRecommendation(e.target.value as Recommendation)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600">
                    {REC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>

                <label className="block text-xs font-medium text-gray-600">Notes <span className="text-gray-400">(optional)</span>
                  <textarea value={overallNotes} onChange={(e) => setOverallNotes(e.target.value)} rows={3} maxLength={5000}
                    placeholder="What stood out? Strengths, concerns, evidence…"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600" />
                </label>

                {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
                <Button type="submit" size="sm" loading={saving} disabled={saving}>
                  {data.mySubmissionId ? "Update scorecard" : "Submit scorecard"}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
