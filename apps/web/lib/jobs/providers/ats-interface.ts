/*
 * ATS Provider Interface — pluggable job data sources.
 *
 * The system supports multiple backends through the JobDataProvider interface.
 * Currently uses the DatabaseProvider (Prisma-backed). Can be swapped to any
 * ATS (Greenhouse, Lever, Workday, Employ) by implementing this interface.
 *
 * Architecture:
 *   Web Frontend → /api/jobs → getJobProvider() → DatabaseProvider | GreenhouseProvider | LeverProvider
 *
 * To add a new ATS:
 *   1. Create a new file: lib/jobs/providers/greenhouse.ts
 *   2. Implement JobDataProvider
 *   3. Register in provider.ts via setJobProvider()
 *
 * DO NOT couple any frontend code to a specific provider.
 * All access goes through the provider interface.
 */

import type { JobDataProvider } from "../types";

/* ================================================================== */
/*  Mock Provider — for testing & demo without a database              */
/* ================================================================== */

// Already exists: lib/jobs/mockData.ts
// Used as fallback when database is unavailable.

/* ================================================================== */
/*  Database Provider — current production provider                    */
/* ================================================================== */

// Already exists: lib/jobs/dbProvider.ts
// Backed by Prisma + SQLite/PostgreSQL.

/* ================================================================== */
/*  Greenhouse Provider — PLACEHOLDER                                  */
/* ================================================================== */

// To implement:
// import type { JobDataProvider, ... } from "./types";
//
// class GreenhouseProvider implements JobDataProvider {
//   private apiKey: string;
//   private boardToken: string;
//
//   constructor(config: { apiKey: string; boardToken: string }) {
//     this.apiKey = config.apiKey;
//     this.boardToken = config.boardToken;
//   }
//
//   async search(params) { ... }
//   async getById(id) { ... }
//   async apply(application) { ... }
// }

/* ================================================================== */
/*  Lever Provider — PLACEHOLDER                                       */
/* ================================================================== */

// To implement:
// class LeverProvider implements JobDataProvider {
//   private apiKey: string;
//
//   constructor(config: { apiKey: string }) { ... }
//   async search(params) { ... }
//   async getById(id) { ... }
//   async apply(application) { ... }
// }

/* ================================================================== */
/*  Workday Provider — PLACEHOLDER                                     */
/* ================================================================== */

// To implement:
// class WorkdayProvider implements JobDataProvider {
//   private tenantUrl: string;
//   async search(params) { ... }
//   async getById(id) { ... }
//   async apply(application) { ... }
// }

/* ================================================================== */
/*  Provider Factory                                                   */
/* ================================================================== */

/**
 * Example: how to switch providers
 *
 * import { setJobProvider } from "@/lib/jobs/provider";
 * import { GreenhouseProvider } from "@/lib/jobs/providers/greenhouse";
 *
 * setJobProvider(new GreenhouseProvider({
 *   apiKey: process.env.GREENHOUSE_API_KEY!,
 *   boardToken: process.env.GREENHOUSE_BOARD_TOKEN!,
 * }));
 */

export type { JobDataProvider };
