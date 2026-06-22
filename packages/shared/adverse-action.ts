/*
 * @career-builder/shared/adverse-action — pure rejection-reason logic (ADR-0010).
 *
 * A recruiter records a STRUCTURED reason when rejecting an application (or
 * declining/rescinding an offer). The category is a CLOSED vocabulary so it can
 * never structurally contain another candidate's identity ("stronger_candidates"
 * is a category, never "we hired Jane"). `freeText` is internal-only; the candidate
 * only ever sees a curated `candidateMessage` (or a safe generic label), and only
 * when the recruiter explicitly opted to share. Pure + framework-agnostic.
 */

export type AdverseCategory =
  | "screening_failed"
  | "experience_gap"
  | "role_filled"
  | "stronger_candidates"
  | "not_responsive"
  | "other";

export const ADVERSE_CATEGORIES: readonly AdverseCategory[] = [
  "screening_failed",
  "experience_gap",
  "role_filled",
  "stronger_candidates",
  "not_responsive",
  "other",
] as const;

export type AdverseKind = "rejection" | "offer_declined" | "offer_rescinded";

export function isAdverseCategory(v: unknown): v is AdverseCategory {
  return typeof v === "string" && (ADVERSE_CATEGORIES as readonly string[]).includes(v);
}

/** Recruiter-facing labels (for the picker). */
const CATEGORY_LABELS: Record<AdverseCategory, string> = {
  screening_failed: "Didn't meet screening criteria",
  experience_gap: "Experience gap vs. requirements",
  role_filled: "Role filled / closed",
  stronger_candidates: "Moved forward with other candidates",
  not_responsive: "Candidate not responsive",
  other: "Other",
};

/** Candidate-safe generic messages — used when no curated message is provided. */
const CANDIDATE_LABELS: Record<AdverseCategory, string> = {
  screening_failed: "Your application didn't meet some of the role's screening criteria.",
  experience_gap: "Your experience didn't align closely enough with this role's requirements.",
  role_filled: "This role has now been filled or closed.",
  stronger_candidates: "We decided to move forward with other candidates for this role.",
  not_responsive: "We weren't able to reach you in time for this role.",
  other: "We've decided not to move forward with your application at this time.",
};

export function categoryLabel(c: AdverseCategory): string {
  return CATEGORY_LABELS[c] ?? c;
}

export function candidateLabel(c: AdverseCategory): string {
  return CANDIDATE_LABELS[c] ?? CANDIDATE_LABELS.other;
}

export interface AdverseActionRow {
  category: string;
  candidateMessage?: string | null;
  sharedWithCandidate?: boolean | null;
  freeText?: string | null;
}

/**
 * Candidate-safe projection: returns `{category, message}` ONLY when the recruiter
 * shared it; otherwise null. The message is the curated copy or a safe generic
 * label — NEVER `freeText`.
 */
export function candidateProjection(
  row: AdverseActionRow,
): { category: string; message: string } | null {
  if (!row.sharedWithCandidate) return null;
  const cat = isAdverseCategory(row.category) ? row.category : "other";
  const message = (row.candidateMessage && row.candidateMessage.trim()) || candidateLabel(cat);
  return { category: cat, message };
}
