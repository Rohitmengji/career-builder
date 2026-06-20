/*
 * @career-builder/shared/blind-hiring — server-enforced candidate redaction.
 *
 * Blind hiring redacts identifying fields from EVERY recruiter-facing candidate
 * payload, server-side, before it leaves the API. Per ADR-0001 + the brief:
 * default-DENY — if a configured field is present it is masked; identity must
 * never appear in a recruiter payload while the mode is on.
 *
 * Config lives in Tenant.settings.blindHiring (no migration). Pure + framework
 * agnostic so it is unit-testable and reusable by any recruiter-facing route.
 */

/** Identifying fields that can be redacted. Non-identifying fields (job, status,
 *  rating, dates, skills/score) are intentionally NOT redactable. */
export const REDACTABLE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "linkedinUrl",
  "resumeUrl",
  "resumePath",
  "resumeText",
  "location",
] as const;

export type RedactableField = (typeof REDACTABLE_FIELDS)[number];

export interface BlindHiringConfig {
  enabled: boolean;
  /** Which identifying fields to redact when enabled. */
  fields: RedactableField[];
}

/** Sensible default: redact everything identifying. */
export const DEFAULT_BLIND_HIRING: BlindHiringConfig = {
  enabled: false,
  fields: [...REDACTABLE_FIELDS],
};

/**
 * Parse Tenant.settings (string JSON or object) → BlindHiringConfig.
 * Defensive: malformed config yields { enabled: false } (fail-safe = visible is
 * the prior behavior; the redaction itself is default-deny on the chosen fields).
 */
export function parseBlindHiring(settings: unknown): BlindHiringConfig {
  try {
    const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
    const bh = (parsed as { blindHiring?: unknown } | null)?.blindHiring as
      | { enabled?: unknown; fields?: unknown }
      | undefined;
    if (!bh || typeof bh !== "object") return { ...DEFAULT_BLIND_HIRING };
    const enabled = bh.enabled === true;
    const fields = Array.isArray(bh.fields)
      ? (bh.fields.filter((f): f is RedactableField =>
          (REDACTABLE_FIELDS as readonly string[]).includes(f as string)))
      : [...REDACTABLE_FIELDS];
    // Enabled with an empty field list is meaningless → fall back to all fields.
    return { enabled, fields: fields.length ? fields : [...REDACTABLE_FIELDS] };
  } catch {
    return { ...DEFAULT_BLIND_HIRING };
  }
}

/** Stable, non-identifying display label for a redacted applicant. */
export function redactedLabel(id: string): string {
  return `Candidate ${String(id).slice(-5).toUpperCase()}`;
}

/**
 * Redact identifying fields on a single recruiter-facing applicant object.
 * Returns a NEW object (never mutates input). Default-deny: a configured field
 * is always masked, even if unexpectedly present under a different shape.
 *
 * - firstName → "Candidate", lastName → "#<id5>", or a combined label;
 * - contact/links/resume → null (recruiter can't open identifying docs);
 * - adds `redacted: true` so the UI can render a blind badge.
 */
export function redactApplicant<T extends { id: string }>(
  applicant: T,
  config: BlindHiringConfig,
): T & { redacted?: boolean } {
  if (!config.enabled) return applicant;
  const out: Record<string, unknown> = { ...applicant };
  const f = new Set<string>(config.fields);

  if (f.has("firstName")) out.firstName = "Candidate";
  if (f.has("lastName")) out.lastName = `#${String(applicant.id).slice(-5).toUpperCase()}`;
  if (f.has("email")) out.email = null;
  if (f.has("phone")) out.phone = null;
  if (f.has("linkedinUrl")) out.linkedinUrl = null;
  if (f.has("resumeUrl")) out.resumeUrl = null;
  if (f.has("resumePath")) out.resumePath = null;
  // Extracted resume text is identity-rich (name/email/etc.) — mask it wholesale.
  if (f.has("resumeText")) out.resumeText = null;
  if (f.has("location")) out.location = null;

  out.redacted = true;
  return out as T & { redacted?: boolean };
}

/** Redact a list (convenience). */
export function redactApplicants<T extends { id: string }>(
  applicants: T[],
  config: BlindHiringConfig,
): (T & { redacted?: boolean })[] {
  if (!config.enabled) return applicants;
  return applicants.map((a) => redactApplicant(a, config));
}
