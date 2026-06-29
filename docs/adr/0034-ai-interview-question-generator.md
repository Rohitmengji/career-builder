# ADR-0034: AI interview-question generator (rubric-grounded)

Status: Accepted · Recruiter AI aid, on the structured-fair-interviewing thesis. Builds on scorecards (ADR-0007) + the evidence-coverage gate (ADR-0031); reuses the JD-bias-check AI contract (ADR-0014/0026).

## Context

Structured interviews — every candidate asked consistent, job-related questions scored against a fixed rubric — are the single most reliable way to reduce hiring bias and improve signal. The platform already has the rubric (ADR-0007 scorecards) and nudges evidence-based scoring (ADR-0031), but interviewers still invent questions ad hoc, which reintroduces inconsistency and bias. Nothing helps them prepare consistent, rubric-aligned questions.

## Decision

- **AI client `ai-client/interview-questions.generateInterviewQuestions`** — given a job's title + requirements + scorecard rubric criteria (+ optional level), returns 1–2 structured questions **per rubric criterion** plus a few role-level questions, each with a `lookFor` (what a strong, evidence-based answer demonstrates, so interviewers score on evidence not gut feel). Same hardened contract as the other engines: versioned prompt (`interview-questions-v1`), low-ish temperature (0.4 for variety), zod-schema-validated, code-fence-tolerant, **fail-closed**. **Fairness-scoped**: the prompt forbids protected/non-job attributes (age, gender, race, religion, national origin, marital/family status, pregnancy, disability, health, orientation, salary history) and requires grounding in the provided rubric/requirements. **Input is job-level only — no candidate PII.**
- **Route `POST /api/admin/jobs/interview-questions`** — stateless (input from the editor's current form state, so it works on unsaved drafts, exactly like the JD bias check). Recruiter+ (`WRITE_ROLES`), CSRF, flag-gated (`ai_interview_questions`), inputs sanitized + bounded, KV-cached on the content hash + prompt version, `ai_oversight` audit entry (EU AI-Act §14).
- **UI** — a "✨ Suggest interview questions for this rubric" button in the job editor, beneath the rubric field; renders the questions inline grouped by criterion, labelled advisory.

Flag `ai_interview_questions`, default-off.

## Consequences

Interviewers get consistent, rubric-aligned, fair questions to prepare with — operationalizing structured interviewing (the strongest debiasing practice) and reinforcing the scorecard/evidence-coverage story. Advisory only; PII-safe by construction (job-level input); fail-closed; flag-gated; audited.

## Deferred

Optionally grounding a subset of questions in a candidate's PII-stripped résumé skills (already available under Blind Hiring) for tailored probes, and saving a generated set onto the job so the whole panel shares the same question bank — out of scope for v1.
