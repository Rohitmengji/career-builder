# ADR-0004: Server-side resume text extraction (guarded)

Status: Accepted · 2026-06-20 · Reverses the brief's "no untrusted-PDF parsing" stance, deliberately and with guards.

## Context

Resume parsing is table-stakes for an ATS and was entirely missing — recruiters
only got a download link, and the match engine required candidates to paste text.
The original brief avoided server-side untrusted-file parsing for safety. The
product owner explicitly wants it working, so we re-introduce it **with controls
that make the residual risk acceptable**, rather than leaving the gap.

## Decision

1. **Extract on the server, on apply**, so the text is available to recruiters,
   search, and (later) AI structuring — not just the candidate's browser.
2. **Pure-JS parser** (`unpdf` / pdf.js) — no native code, no shell-out, no
   network — confirmed to bundle in the Next 16 build.
3. **Defence-in-depth guards** (`apps/web/lib/resume/extract.ts`):
   - MIME allow-list (PDF, plain text); everything else is skipped.
   - 5MB byte cap (upload route already enforces; re-checked here).
   - 8s wall-clock timeout so a request can't hang.
   - 50k-char output cap; whitespace normalized.
   - **Fail-safe**: returns `null` on anything unexpected and NEVER throws —
     extraction failure can never block or 500 an application.
   - **Per-instance concurrency cap (3)**: the timeout is advisory (pdf.js keeps
     running after we stop awaiting), so we bound concurrent parses; once
     saturated we skip extraction (resumeText stays null). True cancellation needs
     worker-thread isolation — a documented future hardening.
4. **`resumeText` is PII-rich → Blind Hiring redacts it.** Added to
   `REDACTABLE_FIELDS` + `redactApplicant` masks it. List queries `omit` it
   entirely (it's only read in detail fetches), keeping it out of list
   payloads/memory and shrinking the leak surface.

## Consequences

- Recruiters get searchable resume text; the match engine can be fed
  automatically (follow-up). The candidate API already allowlists fields, so it
  is unaffected.
- Residual DoS risk from parse-heavy/decompression-bomb PDFs is bounded (size +
  timeout + concurrency cap + fail-safe) but not eliminated; worker-thread
  isolation is the next hardening if abuse appears (a timeout warning is logged
  to surface it).
- DOCX/RTF are not parsed yet (PDF + plain text only) — additive later.
- Next slices: recruiter resumeText UI + AI structuring (skills/titles/education)
  reusing the matching.ts fail-closed pattern.
