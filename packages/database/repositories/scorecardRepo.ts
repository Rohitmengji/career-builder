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
};
