/*
 * @career-builder/shared/portable-record — Portable Verified Application Record (ADR-0030).
 *
 * NOVEL (no mainstream ATS): a candidate can reveal, to an employer they're applying to,
 * their VERIFIED cross-platform track record — built from THEIR OWN application outcomes
 * across every tenant (candidate ownership is by email, ADR-0001). It turns the
 * candidate's own history into a portable asset they control, instead of data locked in
 * each employer's silo. Candidate-initiated + consent-gated + revocable.
 *
 * PRIVACY: this composes ONLY the candidate's OWN rows (matched by their exact email),
 * and emits COUNTS ONLY — never an employer's name, never another candidate, never any
 * recruiter-side data (notes/ratings/scorecards). The employer learns "this candidate
 * has reached interviews/offers/hires across N employers", never WHERE. Pure: the repo
 * passes the candidate's own {tenantId, status} rows; this reduces them to a safe summary.
 */

export interface OwnApplicationRow {
  tenantId: string;
  status: string;
}

export interface VerifiedFootprint {
  /** Distinct employers (tenants) the candidate has applied to — a COUNT only. */
  employers: number;
  applications: number;
  /** Reached the interview stage or beyond. */
  reachedInterview: number;
  /** Received an offer (or hired). */
  offers: number;
  hired: number;
}

const INTERVIEW_OR_BEYOND = new Set(["interview", "offer", "hired"]);
const OFFER_OR_BEYOND = new Set(["offer", "hired"]);

/** Reduce the candidate's own cross-tenant rows to a counts-only verified footprint. */
export function computeFootprint(rows: OwnApplicationRow[]): VerifiedFootprint {
  const employers = new Set<string>();
  let reachedInterview = 0;
  let offers = 0;
  let hired = 0;
  for (const r of rows) {
    employers.add(r.tenantId);
    if (INTERVIEW_OR_BEYOND.has(r.status)) reachedInterview += 1;
    if (OFFER_OR_BEYOND.has(r.status)) offers += 1;
    if (r.status === "hired") hired += 1;
  }
  return { employers: employers.size, applications: rows.length, reachedInterview, offers, hired };
}
