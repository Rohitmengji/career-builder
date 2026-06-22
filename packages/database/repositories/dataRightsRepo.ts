/*
 * Data Rights Repository — GDPR §17 erasure as anonymize-in-place (ADR-0011).
 *
 * Reconciles "right to be forgotten" with "must retain adverse-action / audit
 * records": destroy the link between person and PII, keep the non-identifying
 * decision records. Tenant + email scoped. Legal hold takes precedence — checked
 * INSIDE the transaction (authoritative; no stale pre-read) so a hold placed
 * concurrently can't be bypassed; if ANY of the candidate's applications is held,
 * the whole request is DEFERRED (no partial erasure). The retention sweep (A3)
 * reuses the same per-application anonymizer.
 */

import { createHash } from "crypto";
import { prisma } from "../client";

/** Sentinel: thrown inside the tx to roll back + signal a legal-hold deferral. */
class LegalHoldDefer extends Error {}

/** Irreversible, collision-resistant pseudonym so join-key columns stay non-null. */
function anonEmail(email: string): string {
  const h = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24);
  return `anon-${h}@redacted.invalid`;
}

/** Fields nulled / pseudonymized on an anonymized application. Shared with A3. */
export function anonymizedApplicationData(email: string, now: Date) {
  return {
    firstName: "Redacted",
    lastName: "Candidate",
    email: anonEmail(email),
    phone: null,
    resumeUrl: null,
    resumePath: null,
    resumeText: null,
    coverLetter: null,
    linkedinUrl: null,
    anonymizedAt: now,
  } as const;
}

export interface DeleteResult {
  deferred: boolean;
  reason?: string;
  applicationsAnonymized: number;
  notificationsDeleted: number;
  candidateDeleted: boolean;
  /** Storage keys of résumé blobs to delete out-of-band (caller owns storage). */
  resumeKeys: string[];
}

export const dataRightsRepo = {
  /**
   * Erase a candidate's personal data across the tenant. Anonymizes their
   * applications (keeping the rows + decision records), deletes the Candidate
   * account + their notifications, pseudonymizes their consent history, and nulls
   * candidate-authored free text on adverse-actions + offers. Deferred entirely if
   * any application is under legal hold. Returns the résumé storage keys so the
   * caller can delete the blobs (storage lives outside packages/database).
   */
  async deleteCandidateData(tenantId: string, email: string, now: Date): Promise<DeleteResult> {
    const lc = email.toLowerCase();
    try {
      return await prisma.$transaction(async (tx) => {
        // Authoritative, in-transaction scoping — never a stale pre-read.
        const apps = await tx.application.findMany({
          where: { tenantId, email: lc },
          select: { id: true, legalHold: true, resumePath: true },
        });
        // Legal hold takes precedence — abort the WHOLE erasure (rolls back).
        if (apps.some((a) => a.legalHold)) throw new LegalHoldDefer();

        const appIds = apps.map((a) => a.id);
        const resumeKeys = apps.map((a) => a.resumePath).filter((k): k is string => !!k);

        // 1. Anonymize the candidate's applications. `legalHold:false` in the WHERE
        //    is belt-and-suspenders alongside the in-tx hold check above.
        const anon = await tx.application.updateMany({
          where: { tenantId, email: lc, legalHold: false, anonymizedAt: null },
          data: anonymizedApplicationData(lc, now),
        });

        if (appIds.length > 0) {
          // 2. Keep adverse-action records (retention) but strip ALL candidate text
          //    (curated message + internal free-text, which may quote the candidate).
          await tx.adverseAction.updateMany({
            where: { tenantId, applicationId: { in: appIds } },
            data: { candidateMessage: null, freeText: null },
          });
          // 3. Null candidate-authored offer decision notes.
          await tx.offer.updateMany({
            where: { tenantId, applicationId: { in: appIds } },
            data: { decisionNote: null },
          });
        }

        // 4. Notifications are keyed by email (no FK) — hard-delete the candidate's.
        const notifs = await tx.notification.deleteMany({
          where: { tenantId, recipientType: "candidate", recipientId: lc },
        });

        // 5. Pseudonymize consent history (keep the legal evidence trail, de-identified).
        await tx.consent.updateMany({
          where: { tenantId, subjectEmail: lc },
          data: { subjectEmail: anonEmail(lc) },
        });

        // 6. Delete the Candidate account itself.
        const cand = await tx.candidate.deleteMany({ where: { tenantId, email: lc } });

        // 7. PII-free audit row proving the request was honored.
        await tx.auditLog.create({
          data: {
            tenantId,
            action: "candidate_data_erased",
            entity: "candidate",
            details: JSON.stringify({ applicationsAnonymized: anon.count, notificationsDeleted: notifs.count }),
          },
        });

        return {
          deferred: false,
          applicationsAnonymized: anon.count,
          notificationsDeleted: notifs.count,
          candidateDeleted: cand.count > 0,
          resumeKeys,
        };
      });
    } catch (e) {
      if (e instanceof LegalHoldDefer) {
        return { deferred: true, reason: "legal_hold", applicationsAnonymized: 0, notificationsDeleted: 0, candidateDeleted: false, resumeKeys: [] };
      }
      throw e;
    }
  },
};
