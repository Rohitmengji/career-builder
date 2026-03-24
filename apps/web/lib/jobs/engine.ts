/*
 * Job Query Engine — search, filter, facets, pagination, sorting.
 *
 * Pure functions. No side effects. No API coupling.
 * Takes a Job[] and JobSearchParams, returns JobSearchResponse.
 *
 * This is the core logic layer that works with ANY data source —
 * mock data today, Greenhouse API tomorrow.
 */

import type {
  Job,
  JobSearchParams,
  JobSearchResponse,
  JobFacets,
  FacetBucket,
} from "./types";

/* ================================================================== */
/*  Text search                                                        */
/* ================================================================== */

/**
 * Score a job against a search query. Returns 0 if no match.
 * Higher score = better match. Searches title, department, location,
 * description, tags, and employment type.
 */
function searchScore(job: Job, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1; // no query = everything matches

  const fields = [
    { text: job.title, weight: 5 },
    { text: job.department, weight: 3 },
    { text: job.location, weight: 3 },
    { text: job.tags.join(" "), weight: 2 },
    { text: job.employmentType, weight: 2 },
    { text: job.description, weight: 1 },
  ];

  let score = 0;
  for (const { text, weight } of fields) {
    const lower = text.toLowerCase();
    if (lower === q) {
      score += weight * 3;           // exact match
    } else if (lower.startsWith(q)) {
      score += weight * 2;           // prefix match
    } else if (lower.includes(q)) {
      score += weight;               // substring match
    }
  }

  // Also check individual words in query
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    for (const word of words) {
      for (const { text, weight } of fields) {
        if (text.toLowerCase().includes(word)) {
          score += weight * 0.5;
        }
      }
    }
  }

  return score;
}

/* ================================================================== */
/*  Filtering                                                          */
/* ================================================================== */

function applyFilters(jobs: Job[], params: JobSearchParams): Job[] {
  let filtered = [...jobs];

  // Tenant filter (always applied)
  if (params.tenantId) {
    filtered = filtered.filter((j) => j.tenantId === params.tenantId);
  }

  // Location filter (case-insensitive partial match)
  if (params.location) {
    const loc = params.location.toLowerCase();
    filtered = filtered.filter((j) => j.location.toLowerCase().includes(loc));
  }

  // Department filter (exact, case-insensitive)
  if (params.department) {
    const dept = params.department.toLowerCase();
    filtered = filtered.filter((j) => j.department.toLowerCase() === dept);
  }

  // Employment type filter
  if (params.employmentType) {
    filtered = filtered.filter((j) => j.employmentType === params.employmentType);
  }

  // Experience level filter
  if (params.experienceLevel) {
    filtered = filtered.filter((j) => j.experienceLevel === params.experienceLevel);
  }

  // Remote filter
  if (params.isRemote === true) {
    filtered = filtered.filter((j) => j.isRemote);
  }

  return filtered;
}

/* ================================================================== */
/*  Facets — compute counts AFTER text search but BEFORE pagination    */
/* ================================================================== */

function buildFacets(jobs: Job[]): JobFacets {
  const locationMap = new Map<string, number>();
  const departmentMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const levelMap = new Map<string, number>();
  let remoteCount = 0;
  let onsiteCount = 0;

  for (const job of jobs) {
    // Location: use the city/state only (before parenthetical)
    const loc = job.location.replace(/\s*\(.*\)$/, "").trim();
    locationMap.set(loc, (locationMap.get(loc) || 0) + 1);

    departmentMap.set(job.department, (departmentMap.get(job.department) || 0) + 1);
    typeMap.set(job.employmentType, (typeMap.get(job.employmentType) || 0) + 1);
    levelMap.set(job.experienceLevel, (levelMap.get(job.experienceLevel) || 0) + 1);

    if (job.isRemote) remoteCount++;
    else onsiteCount++;
  }

  const toBuckets = (map: Map<string, number>): FacetBucket[] =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    location: toBuckets(locationMap),
    department: toBuckets(departmentMap),
    employmentType: toBuckets(typeMap),
    experienceLevel: toBuckets(levelMap),
    isRemote: [
      ...(remoteCount > 0 ? [{ value: "Remote", count: remoteCount }] : []),
      ...(onsiteCount > 0 ? [{ value: "On-site", count: onsiteCount }] : []),
    ],
  };
}

/* ================================================================== */
/*  Sorting                                                            */
/* ================================================================== */

function sortJobs(
  jobs: Array<Job & { _score?: number }>,
  sortBy: JobSearchParams["sortBy"],
  sortOrder: JobSearchParams["sortOrder"],
  hasQuery: boolean,
): Job[] {
  // If there's a search query and no explicit sort, sort by relevance
  if (hasQuery && !sortBy) {
    return jobs.sort((a, b) => (b._score || 0) - (a._score || 0));
  }

  const field = sortBy || "postedAt";
  const dir = sortOrder === "asc" ? 1 : -1;

  return jobs.sort((a, b) => {
    const va = a[field as keyof Job];
    const vb = b[field as keyof Job];
    if (typeof va === "string" && typeof vb === "string") {
      return va.localeCompare(vb) * dir;
    }
    return 0;
  });
}

/* ================================================================== */
/*  Main query function                                                */
/* ================================================================== */

/**
 * Execute a full job search: filter → text search → facets → sort → paginate.
 *
 * 1. Apply hard filters (tenant, location, department, type, level, remote)
 * 2. Apply text search with scoring
 * 3. Build facets from the filtered+searched results
 * 4. Sort (by relevance if search query, else by date)
 * 5. Paginate
 */
export function queryJobs(allJobs: Job[], params: JobSearchParams): JobSearchResponse {
  // Step 1: Apply filters
  let jobs = applyFilters(allJobs, params);

  // Step 2: Text search with scoring
  const hasQuery = Boolean(params.q?.trim());
  if (hasQuery) {
    const scored = jobs
      .map((job) => ({ ...job, _score: searchScore(job, params.q!) }))
      .filter((j) => j._score > 0);
    jobs = scored as typeof jobs;
  }

  // Step 3: Facets (computed from filtered results, BEFORE pagination)
  const facets = buildFacets(jobs);

  // Step 4: Sort
  const sorted = sortJobs(
    jobs as Array<Job & { _score?: number }>,
    params.sortBy,
    params.sortOrder,
    hasQuery,
  );

  // Step 5: Paginate
  const page = Math.max(1, params.page || 1);
  const perPage = Math.min(50, Math.max(1, params.perPage || 10));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const paginatedJobs = sorted.slice(start, start + perPage);

  // Strip internal _score field
  const cleanJobs = paginatedJobs.map((job) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _score, ...rest } = job as Job & { _score?: number };
    return rest;
  });

  return {
    jobs: cleanJobs,
    facets,
    pagination: {
      page,
      perPage,
      total,
      totalPages,
    },
  };
}

/**
 * Find related jobs for a given job (same department, different ID).
 * Returns up to `limit` jobs.
 */
export function findRelatedJobs(allJobs: Job[], job: Job, limit: number = 3): Job[] {
  return allJobs
    .filter((j) => j.id !== job.id && j.tenantId === job.tenantId)
    .sort((a, b) => {
      // Same department = higher priority
      const aDept = a.department === job.department ? 2 : 0;
      const bDept = b.department === job.department ? 2 : 0;
      // Same location = small boost
      const aLoc = a.location === job.location ? 1 : 0;
      const bLoc = b.location === job.location ? 1 : 0;
      return (bDept + bLoc) - (aDept + aLoc);
    })
    .slice(0, limit);
}
