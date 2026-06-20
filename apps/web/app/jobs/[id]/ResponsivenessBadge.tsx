/*
 * ResponsivenessBadge — the candidate-facing "Employer Responsiveness" trust
 * signal (server component, display-only).
 *
 * Renders a compact badge stating the share of applicants who got a response,
 * with an honest sub-line. Renders NOTHING when the score is unavailable
 * (suppressed below the minimum sample) or null — so the caller can mount it
 * unconditionally. All thresholds/definitions are applied upstream
 * (computeResponsiveness); this only formats.
 */

import * as React from "react";
import type { ResponsivenessScore, ResponsivenessGrade } from "@career-builder/shared/responsiveness";

const GRADE_TONE: Record<ResponsivenessGrade, { bg: string; fg: string; dot: string }> = {
  excellent: { bg: "bg-emerald-50", fg: "text-emerald-800", dot: "bg-emerald-500" },
  good: { bg: "bg-blue-50", fg: "text-blue-800", dot: "bg-blue-500" },
  fair: { bg: "bg-amber-50", fg: "text-amber-800", dot: "bg-amber-500" },
  low: { bg: "bg-gray-100", fg: "text-gray-700", dot: "bg-gray-400" },
};

// Labels deliberately claim only what's measured: that applicants get an ANSWER
// (yes or no) rather than silence. We don't claim "engagement" — a timely
// rejection is a legitimate answer and the opposite of ghosting (see ADR-0003).
const GRADE_LABEL: Record<ResponsivenessGrade, string> = {
  excellent: "Excellent applicant response",
  good: "Strong applicant response",
  fair: "Responds to applicants",
  low: "Applicant response rate",
};

export default function ResponsivenessBadge({
  score,
  className = "",
}: {
  score: ResponsivenessScore | null;
  className?: string;
}) {
  if (!score || !score.available || score.responseRate === null || score.grade === null) {
    return null;
  }

  const tone = GRADE_TONE[score.grade];

  return (
    <div
      className={`inline-flex items-start gap-2.5 rounded-xl ${tone.bg} px-3.5 py-2.5 ${className}`}
      role="note"
      aria-label={`Employer responsiveness: ${score.responseRate}% of applicants receive an answer, not silence`}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${tone.fg}`}>
          {GRADE_LABEL[score.grade]} · {score.responseRate}% of applicants get an answer
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          Measured from the {score.sampleSize.toLocaleString()} most recent applicants who applied
          over two weeks ago — so you know you&apos;ll hear back, not be ghosted.
        </p>
      </div>
    </div>
  );
}
