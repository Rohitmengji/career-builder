/*
 * Job Repository — CRUD + search for jobs.
 */

import { prisma } from "../client";
import type { Prisma } from "@prisma/client";

export interface JobSearchFilters {
  tenantId: string;
  q?: string;
  department?: string;
  location?: string;
  employmentType?: string;
  experienceLevel?: string;
  isRemote?: boolean;
  isPublished?: boolean;
}

export interface CreateJobInput {
  title: string;
  slug: string;
  department: string;
  location: string;
  description: string;
  employmentType?: string;
  experienceLevel?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  requirements?: string[];
  niceToHave?: string[];
  benefits?: string[];
  tags?: string[];
  isRemote?: boolean;
  isPublished?: boolean;
  tenantId: string;
}

export const jobRepo = {
  async findById(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    });
  },

  async findBySlug(slug: string, tenantId: string) {
    return prisma.job.findUnique({
      where: { slug_tenantId: { slug, tenantId } },
    });
  },

  async search(filters: JobSearchFilters, page = 1, perPage = 10) {
    const where: Prisma.JobWhereInput = { tenantId: filters.tenantId };

    if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
    if (filters.department) where.department = filters.department;
    if (filters.location) where.location = { contains: filters.location };
    if (filters.employmentType) where.employmentType = filters.employmentType;
    if (filters.experienceLevel) where.experienceLevel = filters.experienceLevel;
    if (filters.isRemote !== undefined) where.isRemote = filters.isRemote;
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q } },
        { description: { contains: filters.q } },
        { tags: { contains: filters.q } },
        { department: { contains: filters.q } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { postedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.job.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  },

  async findByTenant(tenantId: string, includeUnpublished = false) {
    return prisma.job.findMany({
      where: {
        tenantId,
        ...(includeUnpublished ? {} : { isPublished: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { postedAt: "desc" }],
      include: { _count: { select: { applications: true } } },
    });
  },

  async create(data: CreateJobInput) {
    return prisma.job.create({
      data: {
        title: data.title,
        slug: data.slug,
        department: data.department,
        location: data.location,
        description: data.description,
        employmentType: data.employmentType || "full-time",
        experienceLevel: data.experienceLevel || "mid",
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryCurrency: data.salaryCurrency || "USD",
        salaryPeriod: data.salaryPeriod || "yearly",
        requirements: JSON.stringify(data.requirements || []),
        niceToHave: JSON.stringify(data.niceToHave || []),
        benefits: JSON.stringify(data.benefits || []),
        tags: JSON.stringify(data.tags || []),
        isRemote: data.isRemote ?? false,
        isPublished: data.isPublished ?? false,
        tenantId: data.tenantId,
      },
    });
  },

  async update(id: string, data: Partial<CreateJobInput>) {
    const updateData: Prisma.JobUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
    if (data.experienceLevel !== undefined) updateData.experienceLevel = data.experienceLevel;
    if (data.salaryMin !== undefined) updateData.salaryMin = data.salaryMin;
    if (data.salaryMax !== undefined) updateData.salaryMax = data.salaryMax;
    if (data.salaryCurrency !== undefined) updateData.salaryCurrency = data.salaryCurrency;
    if (data.isRemote !== undefined) updateData.isRemote = data.isRemote;
    if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;
    if (data.requirements !== undefined) updateData.requirements = JSON.stringify(data.requirements);
    if (data.niceToHave !== undefined) updateData.niceToHave = JSON.stringify(data.niceToHave);
    if (data.benefits !== undefined) updateData.benefits = JSON.stringify(data.benefits);
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);

    return prisma.job.update({ where: { id }, data: updateData });
  },

  async delete(id: string) {
    return prisma.job.delete({ where: { id } });
  },

  async publish(id: string) {
    return prisma.job.update({
      where: { id },
      data: { isPublished: true, postedAt: new Date() },
    });
  },

  async unpublish(id: string) {
    return prisma.job.update({
      where: { id },
      data: { isPublished: false },
    });
  },

  async reorder(tenantId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      prisma.job.update({ where: { id }, data: { sortOrder: index } }),
    );
    return prisma.$transaction(updates);
  },

  async getFacets(tenantId: string) {
    const jobs = await prisma.job.findMany({
      where: { tenantId, isPublished: true },
      select: {
        department: true,
        location: true,
        employmentType: true,
        experienceLevel: true,
        isRemote: true,
      },
    });

    const count = (arr: string[]) => {
      const map = new Map<string, number>();
      arr.forEach((v) => map.set(v, (map.get(v) || 0) + 1));
      return Array.from(map.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    };

    return {
      department: count(jobs.map((j) => j.department)),
      location: count(jobs.map((j) => j.location)),
      employmentType: count(jobs.map((j) => j.employmentType)),
      experienceLevel: count(jobs.map((j) => j.experienceLevel)),
      isRemote: count(jobs.map((j) => String(j.isRemote))),
    };
  },
};
