/*
 * @career-builder/shared/data-export — pure GDPR §15 export assembler (ADR-0011).
 *
 * Shapes a candidate's data-subject export by WHITELISTING fields, so a test can
 * assert exactly what ships. It explicitly never copies recruiter-internal data
 * (notes, ratings, scorecards, adverse-action freeText), other people's data, or
 * EEO self-ID — even if a caller passes a raw row that contains them. Pure +
 * framework-agnostic; the route fetches via tenant-scoped repos and passes rows in.
 */

type Row = Record<string, unknown>;

function pick<T extends Row>(o: T | null | undefined, keys: string[]): Row {
  const out: Row = {};
  if (!o) return out;
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

export interface CandidateExportInput {
  email: string;
  generatedAt: string; // ISO; passed in for determinism
  profile?: Row | null;
  applications?: Row[];
  interviews?: Row[];
  offers?: Row[];
  consents?: Row[];
}

const PROFILE_FIELDS = ["firstName", "lastName", "email", "phone", "location", "headline", "bio", "linkedinUrl", "createdAt"];
const APPLICATION_FIELDS = ["id", "status", "submittedAt", "updatedAt", "jobTitle", "jobDepartment", "jobLocation"];
const INTERVIEW_FIELDS = ["id", "status", "type", "round", "scheduledAt", "durationMins", "timezone", "jobTitle"];
const OFFER_FIELDS = ["id", "status", "salaryAmount", "salaryCurrency", "salaryPeriod", "startDate", "expiresAt", "terms", "jobTitle"];
const CONSENT_FIELDS = ["type", "policyVersion", "granted", "source", "createdAt"];

export function buildCandidateExport(input: CandidateExportInput) {
  return {
    subject: input.email,
    generatedAt: input.generatedAt,
    profile: input.profile ? pick(input.profile, PROFILE_FIELDS) : null,
    applications: (input.applications ?? []).map((a) => pick(a, APPLICATION_FIELDS)),
    interviews: (input.interviews ?? []).map((i) => pick(i, INTERVIEW_FIELDS)),
    offers: (input.offers ?? []).map((o) => pick(o, OFFER_FIELDS)),
    consents: (input.consents ?? []).map((c) => pick(c, CONSENT_FIELDS)),
  };
}
