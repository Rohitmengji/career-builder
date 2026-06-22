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
      orderBy: { createdAt: "desc" },
    });
  },

  /** Current state per consent type = the latest row's `granted`. */
  async currentFor(tenantId: string, subjectEmail: string): Promise<Record<string, boolean>> {
    const rows = await prisma.consent.findMany({
      where: { tenantId, subjectEmail: subjectEmail.toLowerCase() },
      orderBy: { createdAt: "desc" },
      select: { type: true, granted: true },
    });
    const seen: Record<string, boolean> = {};
    for (const r of rows) if (!(r.type in seen)) seen[r.type] = r.granted; // first = newest
    return seen;
  },
};
