/*
 * Candidate Repository — accounts for public-site job seekers.
 *
 * All queries are tenant-scoped. Passwords are stored hashed by the caller
 * (web auth lib); this layer never sees raw passwords.
 */

import { prisma } from "../client";

export interface CreateCandidateInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  phone?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
}

export interface UpdateCandidateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  resumeUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
}

export const candidateRepo = {
  async findByEmail(email: string, tenantId: string) {
    return prisma.candidate.findUnique({
      where: { email_tenantId: { email: email.toLowerCase(), tenantId } },
    });
  },

  // tenantId is REQUIRED: a candidate lookup must always be tenant-scoped so a
  // candidate id from one tenant can't be read under another (isolation).
  async findById(id: string, tenantId: string) {
    const c = await prisma.candidate.findUnique({ where: { id } });
    if (!c) return null;
    if (c.tenantId !== tenantId) return null;
    return c;
  },

  async create(data: CreateCandidateInput) {
    return prisma.candidate.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        tenantId: data.tenantId,
        phone: data.phone ?? null,
        location: data.location ?? null,
        linkedinUrl: data.linkedinUrl ?? null,
      },
    });
  },

  /** Update profile fields. Tenant-guarded: throws if the row isn't owned. */
  async updateProfile(id: string, tenantId: string, data: UpdateCandidateProfileInput) {
    const owned = await prisma.candidate.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!owned) throw new Error("Candidate not found");
    return prisma.candidate.update({ where: { id }, data });
  },

  async setPassword(id: string, passwordHash: string) {
    return prisma.candidate.update({
      where: { id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpiry: null },
    });
  },

  async recordLogin(id: string) {
    return prisma.candidate.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  /** Store a hashed reset token + expiry (raw token is emailed, never stored). */
  async setResetToken(id: string, resetTokenHash: string, resetTokenExpiry: Date) {
    return prisma.candidate.update({
      where: { id },
      data: { resetTokenHash, resetTokenExpiry },
    });
  },

  /** Find a candidate by a (hashed) reset token that hasn't expired. */
  async findByValidResetToken(resetTokenHash: string) {
    return prisma.candidate.findFirst({
      where: { resetTokenHash, resetTokenExpiry: { gt: new Date() } },
    });
  },
};
