/*
 * MatchPreview — candidate-facing "Right to Explanation" panel (client island).
 *
 * The candidate pastes their experience/resume text and gets a private,
 * explainable fit estimate against the role's real requirements. We send only
 * the pasted text + the job id; the server reads the real requirements and
 * scores it. Nothing here is stored or shared with the employer.
 */

"use client";

import * as React from "react";
import { Card, Button, TextareaField, Badge, Alert, CheckIcon } from "@/components/ui";
// Type-only import (erased at build) — one source of truth shared with the
// server route + scoring service, so the contract can't drift.
import type { MatchResult, MatchBand } from "@career-builder/ai-client/matching";

const BAND_LABEL: Record<MatchBand, string> = {
  strong: "Strong match",
  good: "Good match",
  partial: "Partial match",
  low: "Limited match",
};

const BAND_TONE: Record<MatchBand, "success" | "brand" | "warning" | "neutral"> = {
  strong: "success",
  good: "brand",
  partial: "warning",
  low: "neutral",
};

const MIN_CHARS = 20;
const MAX_CHARS = 8000;

export default function MatchPreview({ jobId }: { jobId: string }) {
  const [text, setText] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = React.useState<MatchResult | null>(null);
  const [error, setError] = React.useState<string>("");

  const trimmed = text.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_CHARS;
  const canSubmit = trimmed.length >= MIN_CHARS && trimmed.length <= MAX_CHARS && status !== "loading";

  const onSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setStatus("loading");
      setError("");
      setResult(null);
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText: trimmed }),
        });
        if (res.status === 429) {
          setError("You're checking matches a lot — please try again in a few minutes.");
          setStatus("error");
          return;
        }
        const data = (await res.json().catch(() => null)) as MatchResult | { error?: string } | null;
        if (!res.ok || !data || !("available" in data)) {
          setError("We couldn't analyze your match right now. Please try again.");
          setStatus("error");
          return;
        }
        setResult(data);
        setStatus("done");
      } catch {
        setError("We couldn't reach the server. Please check your connection and try again.");
        setStatus("error");
      }
    },
    [canSubmit, jobId, trimmed],
  );

  return (
    <Card className="sm:p-8">
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Check your match</h2>
        <Badge tone="brand">Private</Badge>
      </div>
      <p className="mb-5 max-w-[65ch] text-sm leading-relaxed text-gray-600">
        Paste your experience (or resume text) to see how your background lines up with this
        role&apos;s requirements — with the specific strengths and gaps behind the score. This is
        just for you: it&apos;s not saved, not shared with the employer, and never used to screen
        your application. The text you paste is analyzed by an AI service to generate the
        estimate — no need to include your name or contact details.
      </p>

      <form onSubmit={onSubmit}>
        <fieldset disabled={status === "loading"} className="space-y-4">
          <TextareaField
            label="Your experience"
            rows={6}
            placeholder="Paste a few lines about your experience, skills, and past roles…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_CHARS}
            error={tooShort ? `Add at least ${MIN_CHARS} characters.` : undefined}
            hint={`${trimmed.length}/${MAX_CHARS} characters`}
          />
          <Button type="submit" loading={status === "loading"} disabled={!canSubmit}>
            {status === "loading" ? "Analyzing…" : "Check my match"}
          </Button>
        </fieldset>
      </form>

      {status === "error" && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {status === "done" && result && (
        <div className="mt-6">
          {!result.available || result.score === null || result.band === null ? (
            <Alert tone="info">
              We couldn&apos;t generate a match for this role right now. Your application is still
              welcome — this tool is just an optional self-check.
            </Alert>
          ) : (
            <Results result={result} band={result.band} score={result.score} />
          )}
        </div>
      )}
    </Card>
  );
}

function Results({ result, band, score }: { result: MatchResult; band: MatchBand; score: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-gray-200/80 bg-gray-50 p-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-900 ring-1 ring-gray-200"
          aria-hidden="true"
        >
          {score}
        </div>
        <div>
          <Badge tone={BAND_TONE[band]}>{BAND_LABEL[band]}</Badge>
          <p className="mt-1.5 text-sm text-gray-600">
            Estimated fit: <span className="font-medium text-gray-900">{score}/100</span> against
            this role&apos;s stated requirements.
          </p>
        </div>
      </div>

      {result.strengths.length > 0 && (
        <div>
          <h3 className="mb-2.5 text-sm font-semibold text-gray-900">Where you line up</h3>
          <ul className="space-y-2.5">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  {s.text}
                  {s.requirement && (
                    <span className="mt-0.5 block text-xs text-gray-500">↳ {s.requirement}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.gaps.length > 0 && (
        <div>
          <h3 className="mb-2.5 text-sm font-semibold text-gray-900">Where to strengthen</h3>
          <ul className="space-y-2.5">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
                <span>
                  {g.text}
                  {g.requirement && (
                    <span className="mt-0.5 block text-xs text-gray-500">↳ {g.requirement}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400">
        An AI estimate based on the text you pasted — a guide, not a decision. Employers don&apos;t
        see this.
      </p>
    </div>
  );
}
