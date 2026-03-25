/*
 * User Repository — CRUD + auth helpers for users.
 */

import { prisma } from "../client";
import type { Prisma } from "@prisma/client";

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role?: string;
  department?: string;
  tenantId: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: string;
  department?: string;
  passwordHash?: string;
  passwordChangedAt?: Date;
  isActive?: boolean;
}

export const userRepo = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string, tenantId: string) {
    return prisma.user.findFirst({
      where: { email: email.toLowerCase(), tenantId, isActive: true },
    });
  },

  async findByTenant(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  },

  /**
   * Create a new user, or reactivate a previously soft-deleted user with the same email+tenant.
   * Uses upsert to handle the @@unique([email, tenantId]) constraint safely.
   */
  async create(data: CreateUserInput) {
    return prisma.user.upsert({
      where: {
        email_tenantId: { email: data.email.toLowerCase(), tenantId: data.tenantId },
      },
      // Reactivate soft-deleted user with fresh data
      update: {
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role || "viewer",
        department: data.department ?? null,
        isActive: true,
      },
      // Normal creation path for genuinely new users
      create: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role || "viewer",
        department: data.department,
        tenantId: data.tenantId,
      },
    });
  },

  async update(id: string, data: UpdateUserInput) {
    return prisma.user.update({
      where: { id },
      data: data as Prisma.UserUpdateInput,
    });
  },

  async delete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async updateLastLogin(id: string) {
    return prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  },

  async countAdmins(tenantId: string) {
    return prisma.user.count({
      where: { tenantId, role: { in: ["admin", "super_admin"] }, isActive: true },
    });
  },
};
