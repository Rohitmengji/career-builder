/*
 * Interview Repository — scheduling (ADR-0006). Tenant-scoped throughout.
 * Candidate↔interview ownership is resolved via the application's email
 * (no candidateId FK, ADR-0001).
 */

import { prisma } from "../client";

export interface CreateInterviewInput {
  tenantId: string;
  applicationId: string;
  jobId?: string | null;
  round?: number;
  type?: string; // phone | video | onsite
  status?: string;
  interviewerId?: string | null;
  scheduledAt: Date;
  durationMins?: number;
  timezone?: string;
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
}

const INTERVIEWER_SELECT = { select: { id: true, name: true, email: true } } as const;

export const interviewRepo = {
  async create(data: CreateInterviewInput) {
    return prisma.interview.create({
      data: {
        tenantId: data.tenantId,
        applicationId: data.applicationId,
        jobId: data.jobId ?? null,
        round: data.round ?? 1,
        type: data.type ?? "video",
        status: data.status ?? "scheduled",
        interviewerId: data.interviewerId ?? null,
        scheduledAt: data.scheduledAt,
        durationMins: data.durationMins ?? 45,
        timezone: data.timezone ?? "UTC",
        location: data.location ?? null,
        meetingUrl: data.meetingUrl ?? null,
        notes: data.notes ?? null,
      },
    });
  },

  /** One interview, tenant-scoped, with interviewer + minimal application/job. */
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.interview.findFirst({
      where: { id, tenantId },
      include: {
        interviewer: INTERVIEWER_SELECT,
        application: { select: { id: true, firstName: true, lastName: true, email: true, job: { select: { title: true } } } },
      },
    });
  },

  /** Interviews for one application (recruiter view), tenant-scoped. */
  async listForApplication(tenantId: string, applicationId: string) {
    return prisma.interview.findMany({
      where: { tenantId, applicationId },
      include: { interviewer: INTERVIEWER_SELECT },
      orderBy: { scheduledAt: "desc" },
    });
  },

  /** The candidate's own interviews (matched by application email), tenant-scoped. */
  async listForCandidate(email: string, tenantId: string) {
    return prisma.interview.findMany({
      where: { tenantId, application: { email: email.toLowerCase() } },
      include: { application: { select: { id: true, job: { select: { title: true, department: true } } } } },
      orderBy: { scheduledAt: "asc" },
    });
  },

  /** Fetch an interview ONLY if it belongs to this candidate (email+tenant). */
  async findForCandidate(id: string, email: string, tenantId: string) {
    return prisma.interview.findFirst({
      where: { id, tenantId, application: { email: email.toLowerCase() } },
      include: { application: { select: { id: true, job: { select: { title: true } } } } },
    });
  },

  /** Tenant-scoped update; returns rows changed (0 = not owned / not found). */
  async update(id: string, tenantId: string, data: Partial<{ status: string; scheduledAt: Date; durationMins: number; timezone: string; interviewerId: string | null; location: string | null; meetingUrl: string | null; notes: string | null; type: string; round: number }>) {
    const res = await prisma.interview.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },
};
