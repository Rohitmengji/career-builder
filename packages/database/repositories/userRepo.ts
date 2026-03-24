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
  isActive?: boolean;
}

export const userRepo = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string, tenantId: string) {
    return prisma.user.findUnique({
      where: { email_tenantId: { email: email.toLowerCase(), tenantId } },
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

  async create(data: CreateUserInput) {
    return prisma.user.create({
      data: {
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
      where: { tenantId, role: "admin", isActive: true },
    });
  },
};
