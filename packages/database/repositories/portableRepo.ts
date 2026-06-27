/*
 * Portable Record Repository (ADR-0030) — a deliberate cross-tenant read, but ONLY of
 * the CANDIDATE'S OWN data (the 3rd cross-tenant exception; unlike salary/trust which
 * aggregate OTHER tenants, this reads the requesting candidate's own footprint).
 *
 * Hard rules:
 *  - Matches the candidate's EXACT lowercased email — never anyone else's rows. (GDPR
 *    erasure hashes the email, so anonymized applications stop matching and correctly
 *    drop out of the footprint.)
 *  - Returns only {tenantId, status} for the candidate's own applications, for the pure
 *    shared/portable-record.computeFootprint to reduce to COUNTS. The tenantId is used
 *    solely to count distinct employers and never leaves the server.
 *  - The recruiter route that calls this first verifies a live portable_profile_share
 *    consent grant; this repo is the data read, the route is the gate.
 */

import { prisma } from "../client";

export const portableRepo = {
  /**
   * The candidate's OWN applications across ALL tenants (by exact lc email), bounded.
   * SERVER-ONLY — counts-only footprint; never expose the raw rows / tenantIds.
   */
  async getOwnApplicationsAcrossTenants(email: string, cap = 1000): Promise<{ tenantId: string; status: string }[]> {
    return prisma.application.findMany({
      // anonymizedAt: null excludes GDPR-erased rows — defense-in-depth so a "forgotten"
      // candidate contributes ZERO counts even if a stale share grant survived erasure
      // (the deterministic anon email could otherwise still match). A living candidate's
      // rows have anonymizedAt null and are unaffected.
      where: { email: email.toLowerCase(), anonymizedAt: null },
      select: { tenantId: true, status: true },
      take: cap,
    });
  },
};
