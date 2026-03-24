/*
 * Job Data Provider — production database-backed provider.
 *
 * The provider pattern allows swapping backends without changing frontend code.
 * Currently backed by the Prisma database. Can be switched to ATS APIs
 * (Greenhouse, Lever, Employ) by implementing JobDataProvider.
 */

export { getJobProvider, setJobProvider } from "./dbProvider";
