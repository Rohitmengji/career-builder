# ADR-0032: Devil's Advocate Decision Gate

Status: Accepted · Novel decision-quality aid (research idea, no mainstream ATS has it). EU AI-Act §14 (human-oversight) aligned. Builds on scorecards (ADR-0007); complements the AI Scorecard Bias Linter (ADR-0026), Interviewer Calibration (ADR-0028), and the Evidence-Coverage Gate (ADR-0031).

## Context

Hiring decisions are made under confirmation bias: once a panel leans a way, it mostly seeks confirming evidence. The Trust Layer already audits the *evaluation* (bias linter, evidence coverage) and the *evaluators* (calibration). Nothing yet stress-tests the *decision itself* before it is made. A structured "consider the other side" prompt is one of the few debiasing techniques with real evidence behind it — but it must stay advisory, evidence-grounded, and PII-safe.

## Decision

- **Pure-ish AI client `ai-client/devils-advocate.argueAgainst`** — given the decision being challenged plus ONLY non-identifying evidence (job requirements + per-criterion structured-interview averages + a recommendation-count summary), it returns the strongest evidence-grounded case for the OPPOSITE decision: `{available, proposedDecision, points:[{argument, basis}], caution}`. Same hardened contract as every other engine: versioned prompt (`devils-advocate-v1`), low temperature (0.2), zod-schema-validated output, code-fence-tolerant `safeJson`, **fail-closed** (`{available:false}` on any error/garbage). The prompt forbids protected attributes and forbids fabrication — if the evidence genuinely supports the lean it says so and returns few/no points.
- **No candidate PII reaches the model.** The route passes only: the job's requirements, the per-criterion *averages* (numbers), and a count summary like "1 strong yes, 2 no". No name, email, résumé text, or free-text scorecard comments are ever sent.
- **Route `POST /api/admin/applications/[id]/devils-advocate`** — recruiter+ (`WRITE_ROLES`), `validateCsrf`, `NO_STORE`, flag-gated (404 when `ai_devils_advocate` off). Tenant + hiring-team scoped via `findByIdScoped(id, tenantId)` + `canAccessJob`. The decision being challenged comes from the optional body `{proposedDecision}`, else is derived from the scorecard recommendation lean (positive → leaning hire; otherwise leaning reject — the bias we most want to check). With no scorecards there is nothing to ground on, so it returns an honest "add scorecards first" note without calling the AI. KV-cached on `tenant:app:decision:promptVersion:contentHash` (re-runs free until the evidence changes). Each run writes an `ai_oversight` audit row (no candidate identity in the detail).
- **UI** — a "⚖️ Challenge this decision (devil's advocate)" affordance on the *decision-summary panel* in `ScorecardsDialog` (where the panel weighs the aggregate before deciding). It renders the counter-case inline, labelled **Advisory only — the decision is yours**. Fail-soft on an unavailable result.

Flag `ai_devils_advocate`, default-off.

## Consequences

The panel gets a structured, evidence-grounded prompt to check the other side *before* committing — a debiasing nudge no other ATS offers, and a concrete human-oversight aid for the AI-Act file. It is strictly advisory: it never blocks, delays, or mutates a reject/hire. Risk surface is the same as the other AI engines (bias linter / résumé insights): PII-safe by construction, fail-closed, flag-gated, tenant- + team-isolated, audited.

## Deferred

A per-tenant "require a glance at the counter-case before a terminal decision" soft gate (still non-blocking), and feeding the candidate's PII-stripped résumé skills (already available under Blind Hiring) as additional grounding once that channel's PII guarantees are re-verified for this path.
