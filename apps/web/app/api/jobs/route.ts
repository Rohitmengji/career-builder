/*
 * Job Search API — BFF endpoint for job listing, search, and filtering.
 *
 * GET /api/jobs?q=engineer&department=Engineering&location=Remote&page=1&perPage=10
 *
 * Returns: { jobs, facets, pagination }
 *
 * This route is the ONLY way the frontend accesses job data.
 * Backend can be swapped (mock → Greenhouse → Lever) without UI changes.
 */

import { NextResponse } from "next/server";
import { getJobProvider } from "@/lib/jobs/provider";
import type { JobSearchParams, EmploymentType, ExperienceLevel } from "@/lib/jobs/types";

const VALID_EMPLOYMENT_TYPES = new Set(["full-time", "part-time", "contract", "internship"]);
const VALID_EXPERIENCE_LEVELS = new Set(["entry", "mid", "senior", "lead", "executive"]);
const VALID_SORT_FIELDS = new Set(["postedAt", "title", "department"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const params: JobSearchParams = {};

    const q = searchParams.get("q")?.trim();
    if (q) params.q = q;

    const location = searchParams.get("location")?.trim();
    if (location) params.location = location;

    const department = searchParams.get("department")?.trim();
    if (department) params.department = department;

    const employmentType = searchParams.get("employmentType")?.trim();
    if (employmentType && VALID_EMPLOYMENT_TYPES.has(employmentType)) {
      params.employmentType = employmentType as EmploymentType;
    }

    const experienceLevel = searchParams.get("experienceLevel")?.trim();
    if (experienceLevel && VALID_EXPERIENCE_LEVELS.has(experienceLevel)) {
      params.experienceLevel = experienceLevel as ExperienceLevel;
    }

    const isRemote = searchParams.get("isRemote");
    if (isRemote === "true") params.isRemote = true;

    const tenantId = searchParams.get("tenantId")?.trim();
    if (tenantId) params.tenantId = tenantId;

    const page = parseInt(searchParams.get("page") || "1", 10);
    if (!isNaN(page) && page > 0) params.page = page;

    const perPage = parseInt(searchParams.get("perPage") || "10", 10);
    if (!isNaN(perPage) && perPage > 0 && perPage <= 50) params.perPage = perPage;

    const sortBy = searchParams.get("sortBy")?.trim();
    if (sortBy && VALID_SORT_FIELDS.has(sortBy)) {
      params.sortBy = sortBy as JobSearchParams["sortBy"];
    }

    const sortOrder = searchParams.get("sortOrder")?.trim();
    if (sortOrder === "asc" || sortOrder === "desc") {
      params.sortOrder = sortOrder;
    }

    // Execute search
    const provider = getJobProvider();
    const result = await provider.search(params);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[API /api/jobs] Error:", error);
    return NextResponse.json(
      {
        jobs: [],
        facets: { location: [], department: [], employmentType: [], experienceLevel: [], isRemote: [] },
        pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 },
      },
      { status: 500 }
    );
  }
}
