/*
 * @career-builder/observability — Performance Monitoring
 *
 * Track slow operations across the stack:
 *   - Database queries
 *   - API response times
 *   - Rendering time
 *   - External API calls
 *
 * Provides a `timer()` utility for instrumenting any async operation.
 */

import { getLogger } from "./logger";
import { metrics, METRIC } from "./metrics";
import { getRequestId } from "./correlation";

const logger = getLogger("performance");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface TimerResult {
  durationMs: number;
  slow: boolean;
}

export interface PerformanceConfig {
  /** Threshold for "slow" warnings (ms). Default: 1000 */
  slowThreshold?: number;
  /** Metric name to record to. */
  metricName?: string;
  /** Labels for the metric. */
  labels?: Record<string, string>;
}

/* ================================================================== */
/*  Timer utility                                                      */
/* ================================================================== */

/**
 * Time an async operation and record metrics.
 *
 * Usage:
 * ```ts
 * const result = await timer("db_query", async () => {
 *   return prisma.job.findMany();
 * }, { slowThreshold: 500, metricName: METRIC.DB_QUERY_DURATION_MS });
 * ```
 */
export async function timer<T>(
  operation: string,
  fn: () => Promise<T>,
  config: PerformanceConfig = {},
): Promise<T> {
  const start = performance.now();
  const threshold = config.slowThreshold ?? 1000;

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);

    // Record metric
    if (config.metricName) {
      metrics.observe(config.metricName, durationMs, config.labels || { operation });
    }

    // Warn on slow operations
    if (durationMs > threshold) {
      logger.warn("slow_operation", {
        operation,
        duration: durationMs,
        threshold,
        requestId: getRequestId(),
        ...config.labels,
      });
    }

    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    logger.error("operation_error", {
      operation,
      duration: durationMs,
      error: err instanceof Error ? err.message : String(err),
      requestId: getRequestId(),
      ...config.labels,
    });
    throw err;
  }
}

/**
 * Create a manual stopwatch for timing code sections.
 *
 * Usage:
 * ```ts
 * const sw = stopwatch("render_page");
 * // ... do work ...
 * const { durationMs, slow } = sw.stop();
 * ```
 */
export function stopwatch(
  operation: string,
  config: PerformanceConfig = {},
): {
  stop: () => TimerResult;
  elapsed: () => number;
} {
  const start = performance.now();
  const threshold = config.slowThreshold ?? 1000;

  return {
    elapsed: () => Math.round(performance.now() - start),
    stop: () => {
      const durationMs = Math.round(performance.now() - start);
      const slow = durationMs > threshold;

      if (config.metricName) {
        metrics.observe(config.metricName, durationMs, config.labels || { operation });
      }

      if (slow) {
        logger.warn("slow_operation", {
          operation,
          duration: durationMs,
          threshold,
          requestId: getRequestId(),
          ...config.labels,
        });
      }

      return { durationMs, slow };
    },
  };
}

/* ================================================================== */
/*  Database query wrapper                                             */
/* ================================================================== */

/**
 * Time a database operation.
 *
 * Usage:
 * ```ts
 * const jobs = await timedDbQuery("find_jobs", () =>
 *   prisma.job.findMany({ where: { tenantId } })
 * );
 * ```
 */
export async function timedDbQuery<T>(
  queryName: string,
  fn: () => Promise<T>,
  labels?: Record<string, string>,
): Promise<T> {
  return timer(queryName, fn, {
    slowThreshold: 500,
    metricName: METRIC.DB_QUERY_DURATION_MS,
    labels: { query: queryName, ...labels },
  });
}

/* ================================================================== */
/*  Render timer                                                       */
/* ================================================================== */

/**
 * Time a rendering operation (SSR page render, component render, etc.).
 */
export async function timedRender<T>(
  pageName: string,
  fn: () => Promise<T>,
): Promise<T> {
  return timer(pageName, fn, {
    slowThreshold: 2000,
    metricName: METRIC.RENDER_DURATION_MS,
    labels: { page: pageName },
  });
}

/* ================================================================== */
/*  Performance Budgets                                                */
/* ================================================================== */

export interface PerformanceBudget {
  /** Metric / operation name pattern. */
  name: string;
  /** Warn threshold in ms. */
  warnMs: number;
  /** Critical threshold in ms (triggers alert). */
  criticalMs: number;
}

const DEFAULT_BUDGETS: PerformanceBudget[] = [
  { name: "api",        warnMs: 500,  criticalMs: 2000 },
  { name: "db",         warnMs: 200,  criticalMs: 1000 },
  { name: "render",     warnMs: 1000, criticalMs: 3000 },
  { name: "external",   warnMs: 2000, criticalMs: 5000 },
];

const budgetViolations = new Map<string, { warn: number; critical: number }>();

/**
 * Check a duration against performance budgets and track violations.
 * Returns the violation level or null if within budget.
 */
export function checkBudget(
  category: string,
  durationMs: number,
  customBudgets?: PerformanceBudget[],
): "warn" | "critical" | null {
  const budgets = customBudgets || DEFAULT_BUDGETS;
  const budget = budgets.find((b) => category.startsWith(b.name));
  if (!budget) return null;

  let violations = budgetViolations.get(category);
  if (!violations) {
    violations = { warn: 0, critical: 0 };
    budgetViolations.set(category, violations);
  }

  if (durationMs >= budget.criticalMs) {
    violations.critical++;
    logger.error("performance_budget_critical", {
      category,
      duration: durationMs,
      threshold: budget.criticalMs,
      totalViolations: violations.critical,
    });
    return "critical";
  }

  if (durationMs >= budget.warnMs) {
    violations.warn++;
    logger.warn("performance_budget_warn", {
      category,
      duration: durationMs,
      threshold: budget.warnMs,
      totalViolations: violations.warn,
    });
    return "warn";
  }

  return null;
}

/** Get a summary of all budget violations. */
export function getBudgetViolations(): Record<string, { warn: number; critical: number }> {
  const result: Record<string, { warn: number; critical: number }> = {};
  for (const [key, val] of budgetViolations) {
    result[key] = { ...val };
  }
  return result;
}

/** Reset budget violation counters. */
export function resetBudgetViolations(): void {
  budgetViolations.clear();
}
