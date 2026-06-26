/*
 * Decision Ledger (ADR-0027) — pure composer + tamper-evident SEAL. No DB, no I/O.
 *
 * NOVEL (no mainstream ATS): at a terminal hiring decision the server composes every
 * candidate-SAFE signal into one ordered, plain-language "receipt" the candidate owns,
 * and SEALS it with a SHA-256 digest stored on the terminal event. If the employer
 * later edits the reason, the recomputed digest no longer matches and the candidate's
 * view shows "modified after your decision."
 *
 * WHAT IS SEALED (decision-time integrity): the ordered candidate-visible STATUS
 * sequence + SCREENING pass/fail + the curated, candidate-safe REASON (closed-vocab
 * category + curated message — NEVER freeText, never another candidate, never identity).
 * NOT sealed: interview feedback (A4) — it is released by a deliberate LATER action, so
 * hashing it would false-positive as "modified"; the panel shows it live, unsealed.
 *
 * INTEGRITY MODEL: the digest is over SEMANTIC CONTENT ONLY (not timestamps), so a
 * re-render with the same meaning verifies. This is "modified-after-decision detection"
 * (the employer controls the server) — integrity, not blockchain non-repudiation.
 *
 * BYTE-IDENTITY CONTRACT: the writer (admin, at decision) and the reader (web, on view)
 * both feed the SAME inputs (decisionLedgerRepo.buildInput) into composeLedger →
 * canonicalize → seal/verify, so a clean record always verifies. canonicalize() is the
 * single definition of the hashed bytes; never serialize the entries any other way.
 */

import crypto from "crypto";
import { candidateProjection, type AdverseActionRow } from "./adverse-action";

export const DECISION_LEDGER_VERSION = 1;

export interface LedgerInput {
  /** Ordered candidate-visible status sequence (toStatus values), oldest → newest. */
  statuses: string[];
  /** Screening pass/fail at apply, or null if the job had no screening. */
  screening?: { passed: boolean } | null;
  /** Candidate-safe rejection reason (shared/adverse-action.candidateProjection), or null. */
  reason?: { category: string; message: string } | null;
}

export type LedgerEntry =
  | { kind: "screening"; passed: boolean }
  | { kind: "status"; status: string }
  | { kind: "reason"; category: string; message: string };

/**
 * Compose the SEALED entries in a FIXED, deterministic order (screening → statuses →
 * reason) — independent of timestamps, so writer and reader always agree.
 */
export function composeLedger(input: LedgerInput): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  if (input.screening) out.push({ kind: "screening", passed: input.screening.passed });
  for (const status of input.statuses) {
    if (status) out.push({ kind: "status", status });
  }
  if (input.reason) out.push({ kind: "reason", category: input.reason.category, message: input.reason.message });
  return out;
}

/**
 * Raw, DB-fetched ledger inputs (packages/database can't import this layer, so it
 * returns this shape and BOTH apps run it through entriesFromRaw — the single bridge
 * that guarantees the writer and reader compose byte-identically).
 */
export interface RawLedgerData {
  statuses: string[];
  screeningPassed: boolean | null;
  adverse: AdverseActionRow | null;
}

/** The ONE app-layer composition (projection + compose). Both seal + verify call it. */
export function entriesFromRaw(raw: RawLedgerData): LedgerEntry[] {
  return composeLedger({
    statuses: raw.statuses,
    screening: raw.screeningPassed === null ? null : { passed: raw.screeningPassed },
    // candidateProjection returns null unless the recruiter shared it (never freeText).
    reason: raw.adverse ? candidateProjection(raw.adverse) : null,
  });
}

/** The ONE definition of the hashed bytes — a stable, key-order-proof encoding. */
export function canonicalize(entries: LedgerEntry[]): string {
  return entries
    .map((e) => {
      switch (e.kind) {
        case "screening": return `Q:${e.passed ? 1 : 0}`;
        case "status": return `S:${e.status}`;
        case "reason": return `R:${e.category}|${e.message}`;
      }
    })
    .join("\n");
}

/** SHA-256 hex over the canonical bytes. */
export function seal(entries: LedgerEntry[]): string {
  return crypto.createHash("sha256").update(canonicalize(entries)).digest("hex");
}

export type LedgerVerdict = "verified" | "modified" | "unsealed";

/**
 * Compare freshly-composed entries against the stored digest (timing-safe):
 *  - no stored digest        → "unsealed"
 *  - recomputed === stored   → "verified"
 *  - otherwise               → "modified" (changed after the decision was sealed)
 */
export function verify(entries: LedgerEntry[], storedDigest: string | null | undefined): LedgerVerdict {
  if (!storedDigest) return "unsealed";
  const fresh = seal(entries);
  if (fresh.length !== storedDigest.length) return "modified";
  // timing-safe equality on equal-length hex strings
  const ok = crypto.timingSafeEqual(Buffer.from(fresh), Buffer.from(storedDigest));
  return ok ? "verified" : "modified";
}
