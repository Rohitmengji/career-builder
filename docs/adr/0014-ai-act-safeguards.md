# ADR-0014: EU AI-Act safeguards

Status: Accepted · 2026-06-25 · Program A (Trust & Compliance), slice A6 — completes the compliance program (A1–A6).

## Context

Recruitment AI is "high-risk" under the EU AI Act (Annex III §4). Beyond the Right-to-Explanation match (ADR shipped earlier), the Act expects: transparency to data subjects (§13), human oversight of AI outputs (§14), and measures against discriminatory outcomes. This slice adds those safeguards.

## Decision

- **JD bias detection** — `packages/ai-client/jd-bias.ts` `detectJdBias` (same hardened contract as matching/resume: versioned prompt `jd-bias-v1`, temperature 0, zod schema-validated, **fail-closed** to `{available:false}`). It flags exclusionary *language* (gendered / age / ableist / culture-gatekeeping) and is explicitly **fairness-scoped**: never flag legitimate job-related requirements. Surfaced as an advisory, **non-blocking** "Check for inclusive language" action in the job editor (`POST /api/admin/jobs/bias-check`, author roles, CSRF, flag `ai_jd_bias_detection`). Findings are suggestions; publish is never blocked.
- **Human-oversight logging (§14)** — the bias-check route writes an `ai_oversight` AuditLog entry recording that a person ran + reviewed the AI output. (The existing match/résumé features already keep a human in the loop; this makes the oversight auditable.)
- **AI transparency (§13)** — a public `/about/ai-usage` page documents where AI is used, that contact PII is stripped before any model call, that no automated hiring decision is made, that voluntary diversity data is never sent to the AI, and the candidate's right to object / export / delete.

## Consequences

The platform now has the core AI-Act safeguards for an employment AI system: transparency, auditable human oversight, fail-closed advisory tooling, and an anti-bias authoring aid — without any AI making or blocking a decision.

## Deferred

A model/version registry surfaced in the disclosure page; bias detection on existing published jobs (currently authoring-time only); periodic fairness audits of match-score distributions.
