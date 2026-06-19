/*
 * Object storage abstraction.
 *
 * WHY: resumes (apps/web) and media uploads (apps/admin) were written to the
 * local filesystem. On Vercel/serverless that filesystem is ephemeral — every
 * deploy (and often every cold start) discards the files, so uploaded resumes
 * and media silently vanished. This module routes writes through a pluggable
 * driver so production can use durable object storage while local dev keeps the
 * zero-config filesystem behavior.
 *
 * Driver selection (env STORAGE_DRIVER):
 *   - "local"  (default)  → filesystem; good for dev. EPHEMERAL on serverless.
 *   - "blob"              → Vercel Blob. Requires BLOB_READ_WRITE_TOKEN and the
 *                            optional `@vercel/blob` package (lazy-imported).
 *   - "s3"                → S3-compatible (S3/R2/MinIO). Requires S3_BUCKET +
 *                            S3_PUBLIC_BASE_URL and `@aws-sdk/client-s3`.
 *
 * Cloud SDKs are imported lazily, so they are only required when their driver
 * is actually selected — no new hard dependency for local dev or CI.
 */

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export type StorageDriver = "local" | "blob" | "s3";

export interface StorageOptions {
  /** Absolute directory the "local" driver writes to. */
  localDir: string;
  /** Public URL prefix the "local" driver returns (e.g. "/api/media/file"). */
  localPublicPrefix: string;
  /** Object-key namespace for cloud drivers (e.g. "media", "resumes"). */
  keyPrefix?: string;
  /**
   * Tenant id. When set, cloud object keys are namespaced under
   * `t/<tenantId>/…` so one tenant's files can't be guessed or listed from
   * another. Reads use the full URL persisted at upload time, so existing
   * files under the old (un-prefixed) keys remain reachable — forward-only.
   */
  tenantId?: string;
}

export interface StoredObject {
  /** Publicly resolvable URL (or app-relative path for the local driver). */
  url: string;
  /** Storage key — pass back to delete(). */
  key: string;
}

export interface ObjectStorage {
  driver: StorageDriver;
  put(filename: string, body: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

function resolveDriver(): StorageDriver {
  const raw = (process.env.STORAGE_DRIVER || "").toLowerCase();
  if (raw === "blob" || raw === "s3" || raw === "local") return raw;
  // Fail loudly in production if durable storage wasn't configured: silently
  // writing to an ephemeral disk is the bug we're fixing.
  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    console.warn(
      "[storage] STORAGE_DRIVER is not set on a serverless deployment — falling " +
        "back to LOCAL filesystem, which is EPHEMERAL. Set STORAGE_DRIVER=blob|s3 " +
        "to persist uploads."
    );
  }
  return "local";
}

/**
 * Build the cloud object key: `t/<tenantId>/<keyPrefix>/<filename>`.
 * Tenant and prefix segments are each optional. Exported for unit testing.
 */
export function objectKeyFor(opts: Pick<StorageOptions, "keyPrefix" | "tenantId">, filename: string): string {
  const segments: string[] = [];
  if (opts.tenantId) segments.push("t", opts.tenantId);
  if (opts.keyPrefix) segments.push(opts.keyPrefix.replace(/^\/+|\/+$/g, ""));
  segments.push(filename);
  return segments.join("/");
}

export function createStorage(opts: StorageOptions): ObjectStorage {
  const driver = resolveDriver();

  if (driver === "blob") {
    return {
      driver,
      async put(filename, body, contentType) {
        // @ts-ignore optional peer dependency, may not be installed
        const { put } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@vercel/blob");
        const key = objectKeyFor(opts, filename);
        const res = await put(key, body, {
          access: "public",
          contentType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
          addRandomSuffix: false,
        });
        return { url: res.url, key };
      },
      async delete(key) {
        // @ts-ignore optional peer dependency, may not be installed
        const { del } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@vercel/blob");
        await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
      },
    };
  }

  if (driver === "s3") {
    const bucket = process.env.S3_BUCKET;
    const publicBase = process.env.S3_PUBLIC_BASE_URL;
    if (!bucket || !publicBase) {
      throw new Error(
        "[storage] STORAGE_DRIVER=s3 requires S3_BUCKET and S3_PUBLIC_BASE_URL"
      );
    }
    return {
      driver,
      async put(filename, body, contentType) {
        // @ts-ignore optional peer dependency, may not be installed
        const { S3Client, PutObjectCommand } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@aws-sdk/client-s3");
        const client = new S3Client({
          region: process.env.S3_REGION || "auto",
          ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
        });
        const key = objectKeyFor(opts, filename);
        await client.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
        );
        return { url: `${publicBase.replace(/\/+$/, "")}/${key}`, key };
      },
      async delete(key) {
        // @ts-ignore optional peer dependency, may not be installed
        const { S3Client, DeleteObjectCommand } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@aws-sdk/client-s3");
        const client = new S3Client({
          region: process.env.S3_REGION || "auto",
          ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
        });
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      },
    };
  }

  // Default: local filesystem (dev). Ephemeral on serverless — see resolveDriver().
  return {
    driver: "local",
    async put(filename, body) {
      await mkdir(opts.localDir, { recursive: true });
      await writeFile(path.join(opts.localDir, filename), body);
      return {
        url: `${opts.localPublicPrefix.replace(/\/+$/, "")}/${filename}`,
        key: filename,
      };
    },
    async delete(key) {
      try {
        await unlink(path.join(opts.localDir, key));
      } catch {
        /* already gone */
      }
    },
  };
}
