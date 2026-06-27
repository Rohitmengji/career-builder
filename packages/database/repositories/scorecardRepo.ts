/*
 * Scorecard Repository — structured interview evaluation (ADR-0007).
 * Tenant-scoped throughout. One scorecard per interviewer per application:
 * re-submitting REPLACES that interviewer's scorecard + its ratings atomically.
 * Caller (API) must verify the application and interviewer belong to the tenant
 * before calling (mirrors the interview route's cross-tenant guard).
 */

import { prisma } from "../client";

export interface ScorecardRatingInput {
  criterion: string;
  score: number;
  comment?: string | null;
}

export interface SubmitScorecardInput {
  tenantId: string;
  applicationId: string;
  interviewerId: string;
  interviewId?: string | null;
  recommendation: string; // strong_yes | yes | no | strong_no
  overallNotes?: string | null;
  ratings: ScorecardRatingInput[];
}

const INTERVIEWER_SELECT = { select: { id: true, name: true, email: true } } as const;

export const scorecardRepo = {
  /**
   * Create or replace the calling interviewer's scorecard for an application.
   * Upserts the scorecard (compound-unique on tenant+application+interviewer) and
   * swaps its ratings in a single transaction so a reader never sees half a set.
   */
  async submit(data: SubmitScorecardInput) {
    const ratings = data.ratings.map((r) => ({
      criterion: r.criterion,
      score: r.score,
      comment: r.comment ?? null,
    }));

    return prisma.$transaction(async (tx) => {
      const scorecard = await tx.scorecard.upsert({
        where: {
          tenantId_applicationId_interviewerId: {
            tenantId: data.tenantId,
            applicationId: data.applicationId,
            interviewerId: data.interviewerId,
          },
        },
        create: {
          tenantId: data.tenantId,
          applicationId: data.applicationId,
          interviewerId: data.interviewerId,
          interviewId: data.interviewId ?? null,
          recommendation: data.recommendation,
          overallNotes: data.overallNotes ?? null,
          ratings: { create: ratings },
        },
        update: {
          interviewId: data.interviewId ?? null,
          recommendation: data.recommendation,
          overallNotes: data.overallNotes ?? null,
          // Replace ratings wholesale.
          ratings: { deleteMany: {}, create: ratings },
        },
        include: { ratings: true, interviewer: INTERVIEWER_SELECT },
      });
      return scorecard;
    });
  },

  /** All scorecards for ONE application (recruiter view), tenant-scoped. */
  async listForApplication(tenantId: string, applicationId: string) {
    return prisma.scorecard.findMany({
      where: { tenantId, applicationId },
      include: { ratings: true, interviewer: INTERVIEWER_SELECT },
      orderBy: { submittedAt: "asc" },
    });
  },

  /** The calling interviewer's own scorecard (to pre-fill the form), tenant-scoped. */
  async findForInterviewer(tenantId: string, applicationId: string, interviewerId: string) {
    return prisma.scorecard.findFirst({
      where: { tenantId, applicationId, interviewerId },
      include: { ratings: true },
    });
  },

  /**
   * Rater-calibration rows (ADR-0028): one row per scorecard that has >=1 rating —
   * { interviewerId, interviewerName, applicationId, score = mean of its 1-5 ratings }.
   * Tenant-scoped + bounded. Internal-only (about evaluators; no candidate PII). Fed to
   * the pure shared/rater-calibration engine.
   */
  async getCalibrationRows(tenantId: string, cap = 5000) {
    // Order by applicationId so a tenant's scorecards for one application are
    // contiguous — calibration compares raters WITHIN an application, so a partial
    // panel (some of an app's raters truncated by the cap) would corrupt the mean and
    // mislabel raters. We fetch cap+1 to detect truncation, then DROP the trailing
    // application group, guaranteeing every returned application has its full panel.
    const cards = await prisma.scorecard.findMany({
      where: { tenantId },
      select: { applicationId: true, interviewerId: true, interviewer: INTERVIEWER_SELECT, ratings: { select: { score: true } } },
      orderBy: [{ applicationId: "asc" }, { interviewerId: "asc" }],
      take: cap + 1,
    });
    // If we got more than `cap`, the fetch was truncated and the LAST application in
    // the set straddles the cut (rows beyond it were dropped) → drop that whole group
    // so every returned application keeps its full panel.
    const truncated = cards.length > cap;
    const lastAppId = truncated && cards.length > 0 ? cards[cards.length - 1].applicationId : null;

    const rows: { interviewerId: string; interviewerName: string; applicationId: string; score: number }[] = [];
    for (const c of cards) {
      if (lastAppId !== null && c.applicationId === lastAppId) continue; // possibly-partial panel
      if (c.ratings.length === 0) continue; // no numeric signal to calibrate on
      const score = c.ratings.reduce((a, r) => a + r.score, 0) / c.ratings.length;
      rows.push({ interviewerId: c.interviewerId, interviewerName: c.interviewer?.name ?? "Unknown", applicationId: c.applicationId, score });
    }
    return rows;
  },
};
