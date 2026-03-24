/*
 * Database resilience layer for SQLite on Vercel.
 *
 * SQLite has limitations in serverless environments:
 *   - No shared filesystem between function invocations
 *   - SQLITE_BUSY errors under concurrent writes
 *   - File must be at a stable, writable path
 *
 * This module provides:
 *   1. Retry logic for SQLITE_BUSY / locked errors
 *   2. Safe path resolution
 *   3. Connection health checking
 *   4. Migration readiness for PostgreSQL
 *
 * IMPORTANT: For Vercel production, SQLite is ephemeral.
 * Use Turso (libSQL) or Neon PostgreSQL for persistent data.
 * This module ensures graceful handling during the transition.
 */

/* ================================================================== */
/*  Retry logic for DB operations                                      */
/* ================================================================== */

const RETRY_DELAYS = [50, 100, 250, 500, 1000]; // ms — exponential-ish backoff
const RETRYABLE_CODES = new Set([
  "SQLITE_BUSY",
  "SQLITE_LOCKED",
  "P2024", // Prisma: timed out fetching connection
  "P2034", // Prisma: write conflict (optimistic locking)
]);

export interface RetryOptions {
  maxRetries?: number;
  /** Called before each retry with attempt number and error */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Execute a database operation with automatic retry on transient errors.
 *
 * @example
 * const user = await withDbRetry(() => prisma.user.findUnique({ where: { id } }));
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? RETRY_DELAYS.length;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const code = extractErrorCode(error);
      const isRetryable = code ? RETRYABLE_CODES.has(code) : false;

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]!;
      options?.onRetry?.(attempt + 1, error);

      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[db-retry] Attempt ${attempt + 1}/${maxRetries} after ${code} — waiting ${delay}ms`,
        );
      }

      await sleep(delay);
    }
  }

  // TypeScript: unreachable, but satisfies return type
  throw new Error("[db-retry] Exhausted retries");
}

/* ================================================================== */
/*  Health check                                                       */
/* ================================================================== */

export interface DbHealthStatus {
  healthy: boolean;
  latencyMs: number;
  provider: "sqlite" | "postgresql" | "libsql" | "unknown";
  error?: string;
}

/**
 * Check database connectivity and measure latency.
 */
export async function checkDbHealth(
  prisma: { $queryRawUnsafe: (query: string) => Promise<unknown> },
): Promise<DbHealthStatus> {
  const start = Date.now();
  const dbUrl = process.env.DATABASE_URL || "";
  const provider = detectProvider(dbUrl);

  try {
    // Use a lightweight query that works across SQLite and Postgres
    const query = provider === "postgresql" ? "SELECT 1" : "SELECT 1";
    await prisma.$queryRawUnsafe(query);

    return {
      healthy: true,
      latencyMs: Date.now() - start,
      provider,
    };
  } catch (error: unknown) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      provider,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/* ================================================================== */
/*  Database path helpers                                              */
/* ================================================================== */

/**
 * Detect the database provider from the URL.
 */
export function detectProvider(url: string): DbHealthStatus["provider"] {
  if (url.startsWith("file:") || url.endsWith(".db")) return "sqlite";
  if (url.startsWith("libsql://") || url.startsWith("https://")) return "libsql";
  if (url.startsWith("postgres")) return "postgresql";
  return "unknown";
}

/**
 * Validate that the DATABASE_URL is properly configured for the deploy env.
 */
export function validateDatabaseUrl(): {
  valid: boolean;
  url: string;
  provider: DbHealthStatus["provider"];
  warning?: string;
} {
  const url = process.env.DATABASE_URL || "";
  if (!url) {
    return { valid: false, url, provider: "unknown", warning: "DATABASE_URL is not set" };
  }

  const provider = detectProvider(url);

  // Warn if using SQLite on Vercel (ephemeral filesystem)
  if (provider === "sqlite" && process.env.VERCEL) {
    return {
      valid: true,
      url,
      provider,
      warning:
        "SQLite on Vercel has an ephemeral filesystem. " +
        "Data will be lost between deployments. " +
        "Use Turso (libsql) or Neon (postgresql) for persistent data.",
    };
  }

  return { valid: true, url, provider };
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function extractErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null) {
    // Prisma errors have a `code` property
    if ("code" in error && typeof (error as { code: unknown }).code === "string") {
      return (error as { code: string }).code;
    }
    // SQLite raw errors
    if ("message" in error) {
      const msg = (error as { message: string }).message;
      if (msg.includes("SQLITE_BUSY")) return "SQLITE_BUSY";
      if (msg.includes("SQLITE_LOCKED")) return "SQLITE_LOCKED";
      if (msg.includes("database is locked")) return "SQLITE_BUSY";
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
