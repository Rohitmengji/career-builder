# ADR-0026: AI scorecard bias & consistency linter

Status: Accepted · Novel AI feature (Candidate Trust Layer / fairness). Extends ADR-0014 (JD-bias) from the job posting to the evaluation. Builds on the ADR-0007 scorecards.

## Context

Structured scorecards (ADR-0007) capture interviewer scores + free-text comments. But the *language* of an evaluation is where bias hides — "culture fit", "abrasive", "not one of us", praise with a low score, or conclusions with no evidence. No mainstream ATS audits the evaluation itself; the legal/AI risk keeps them silent. This platform's hardened, fail-closed AI-client contract + AI-Act posture (ADR-0014) make it safe to do responsibly — and fairness in evaluation is squarely on-thesis (the Candidate Trust Layer).

## Decision

- **Pure-ish AI client `packages/ai-client/scorecard-audit.ts`** — `auditScorecard(input)`, versioned prompt `scorecard-audit-v1`, temperature 0, **schema-validated, fail-closed** (malformed/unsafe output → `{ available: false }`). Flags four problem types: `biased_language`, `score_comment_mismatch`, `vague`, `unprofessional` — each with severity, the exact excerpt, why, and an evidence-based suggestion. The prompt is **fairness-scoped**: don't flag legitimate evidence-based assessments, never infer protected attributes, "when unsure, don't flag." Same contract as `jd-bias.ts`.
- **Input is evaluation content only** — the interviewer's scores + comments + recommendation/notes. **No candidate PII** is required or sent.
- **`POST /api/admin/applications/[id]/scorecards/audit`** — recruiter+, CSRF, flag-gated (`ai_scorecard_audit`), **tenant- + hiring-team-scoped** (ADR-0020 `canAccessJob`). KV-cached on the scorecard's **content hash** + prompt version (re-runs free until the scorecard changes). Each run writes an `ai_oversight` audit row (EU AI-Act §14 human-oversight trail).
- **UI** — a "Check this evaluation for bias" button on each scorecard in `ScorecardsDialog`; flags render inline. **Internal-only** — never candidate-visible. Advisory; never blocks a decision.
- **Transparency** — listed on `/about/ai-usage` (AI-Act §13): runs on the interviewer's notes, not candidate data; advisory; human decides.

## Consequences

Interviewers get real-time, private, fairness-oriented feedback on their *own* evaluations before a decision — a uniquely proactive bias safeguard no ATS offers. Default-off; fail-closed; zero candidate exposure.

## Deferred

Panel-level audit (aggregate bias across all interviewers on a candidate), trend reporting (which criteria attract the most biased language), and an optional "must acknowledge flags before submitting" gate.
