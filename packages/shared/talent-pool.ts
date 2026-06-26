/*
 * Talent-pool re-engagement helpers (ADR-0018, B3) — pure, no DB.
 *
 * WHAT: partition a pool's members into who may receive a re-engagement email and
 *   who must be skipped, based on their current MARKETING consent.
 * WHY: re-engaging past candidates is marketing contact. Under GDPR/CAN-SPAM (and
 *   the platform's trust ethos) we only email candidates who granted marketing
 *   consent (ADR-0011 consent ledger). This is the single source of truth for that
 *   gate, so it can be unit-tested independently of the email/DB plumbing.
 * HOW: consentByEmail maps a lowercased email -> its current consent flags (from
 *   consentRepo.currentFor). A member is sendable ONLY if marketing === true.
 *   Emails are compared lowercased; unknown/absent consent => skipped (default-deny).
 */

export interface ReengageMember {
  candidateEmail: string;
}

export interface ConsentFlags {
  [type: string]: boolean;
}

export interface ReengagePartition {
  /** Lowercased emails that granted marketing consent — safe to email. */
  willSend: string[];
  /** Lowercased emails skipped because marketing consent is absent/false. */
  skippedNoConsent: string[];
}

/**
 * Split members into sendable vs skipped by marketing consent. Default-deny: a
 * member with no consent record (or marketing !== true) is skipped. De-dupes by
 * lowercased email.
 */
export function partitionReengageRecipients(
  members: ReengageMember[],
  consentByEmail: Record<string, ConsentFlags>,
): ReengagePartition {
  const willSend: string[] = [];
  const skippedNoConsent: string[] = [];
  const seen = new Set<string>();

  for (const m of members) {
    const email = (m.candidateEmail || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const consent = consentByEmail[email];
    if (consent && consent.marketing === true) willSend.push(email);
    else skippedNoConsent.push(email);
  }

  return { willSend, skippedNoConsent };
}
