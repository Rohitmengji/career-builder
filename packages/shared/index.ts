/*
 * @career-builder/shared — package barrel / public entry point.
 *
 * WHAT: the single import surface for the shared package. Re-exports the
 * cross-app primitives that both apps/admin and apps/web depend on:
 * env/URL resolution, the in-process job queue, the API response helpers,
 * multi-tenant resolution, object storage + KV abstractions, and signed
 * preview tokens.
 *
 * WHY: callers import from "@career-builder/shared" rather than reaching into
 * individual module paths, so internal file layout can change without breaking
 * consumers. This package is pure cross-app logic — NO database access and
 * unit-tested; DB-bound code lives in @career-builder/database instead.
 *
 * HOW: each line either re-exports a module wholesale (`export *`) or names the
 * specific value/type exports to keep the public API explicit. When adding a
 * new shared module, surface it here (prefer named exports for anything with a
 * large or incidental internal API).
 */
export * from "./env";
export { jobQueue } from "./job-queue";
export type { Job, JobHandler, QueueStats } from "./job-queue";
export * from "./api-response";
export * from "./tenant-resolver";
export { createStorage } from "./storage";
export type { ObjectStorage, StorageDriver, StorageOptions, StoredObject } from "./storage";
export { getKV } from "./kv";
export type { KVStore } from "./kv";
export { createPreviewToken, verifyPreviewToken } from "./preview-token";
export type { PreviewClaims } from "./preview-token";
