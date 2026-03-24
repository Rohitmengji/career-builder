/*
 * Job module barrel export.
 * Single import for all job-related functionality.
 */

export type {
  Job,
  JobSearchParams,
  JobSearchResponse,
  JobDetailResponse,
  JobFacets,
  FacetBucket,
  JobApplication,
  ApplyResponse,
  EmploymentType,
  ExperienceLevel,
  JobSalary,
  JobDataProvider,
} from "./types";

export { useJobSearch } from "./useJobSearch";
export type { UseJobSearchResult } from "./useJobSearch";

export { getJobProvider, setJobProvider } from "./provider";
export { queryJobs, findRelatedJobs } from "./engine";
export { MOCK_JOBS } from "./mockData";
