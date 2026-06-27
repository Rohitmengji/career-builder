/*
 * Consent Repository — append-only consent ledger (ADR-0011). Tenant + email scoped.
 * Withdrawal is a NEW granted=false row (never an update) — the legal evidence trail
 * must prove which policy version was consented to, and when it was withdrawn.
 */

import { prisma } from "../client";

export interface RecordConsentInput {
  tenantId: string;
  subjectEmail: string;
  type: string; // privacy_policy | data_processing | marketing
  policyVersion: string;
  granted: boolean;
  source: string; // apply | register | profile_settings
  ipAddress?: string | null;
}

export const consentRepo = {
  async record(input: RecordConsentInput) {
    return prisma.consent.create({
      data: {
        tenantId: input.tenantId,
        subjectEmail: input.subjectEmail.toLowerCase(),
        type: input.type,
        policyVersion: input.policyVersion,
        granted: input.granted,
        source: input.source,
        ipAddress: input.ipAddress ?? null,
      },
    });
  },

  /** Full consent history for a subject (export / audit), newest first. */
  async historyFor(tenantId: string, subjectEmail: string) {
    return prisma.consent.findMany({
      where: { tenantId, subjectEmail: subjectEmail.toLowerCase() },
      // id (cuid) tiebreak: rows written back-to-back can share a createdAt ms, and
      // "latest wins" is the fail-closed guarantee for the consent gates (a revoke must
      // beat a same-tick grant). cuids are monotonic within a process, so id desc picks
      // the truly-last write.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  },

  /** Current state per consent type = the latest row's `granted`.
   *  Fail-closed tie-break: if the newest two rows of a type share the SAME createdAt
   *  (a back-to-back grant+revoke in one millisecond), a `granted=false` among them
   *  WINS — so a revoke can never lose to a grant on a timestamp collision. This is
   *  robust regardless of id ordering (cuid lexicographic order isn't monotonic across
   *  processes); the `id desc` secondary sort is only a best-effort newest-first hint. */
  async currentFor(tenantId: string, subjectEmail: string): Promise<Record<string, boolean>> {
    const rows = await prisma.consent.findMany({
      where: { tenantId, subjectEmail: subjectEmail.toLowerCase() },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { type: true, granted: true, createdAt: true },
    });
    const seen: Record<string, boolean> = {};
    const seenAt: Record<string, number> = {};
    for (const r of rows) {
      const t = r.createdAt.getTime();
      if (!(r.type in seen)) {
        seen[r.type] = r.granted;
        seenAt[r.type] = t;
      } else if (t === seenAt[r.type] && r.granted === false) {
        seen[r.type] = false; // same-millisecond tie → fail closed (revoke wins)
      }
    }
    return seen;
  },
};
