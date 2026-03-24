/*
 * @career-builder/observability — Distributed Tracing
 *
 * Lightweight span-based tracing that extends the correlation system.
 * Tracks nested operations within a request:
 *   API handler → DB query → external API call
 *
 * Each span records:
 *   - name, start/end time, duration
 *   - parent span (for nesting)
 *   - status (ok / error)
 *   - attributes (key-value metadata)
 *
 * The full trace is available via getRequestContext() and can be
 * exported to Jaeger / Zipkin / Datadog APM.
 */

import { getRequestContext, getRequestId } from "./correlation";
import { getLogger } from "./logger";
import { metrics, METRIC } from "./metrics";

const logger = getLogger("tracing");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  service: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: "ok" | "error";
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

/* ================================================================== */
/*  Span storage (per-request via global map keyed by traceId)         */
/* ================================================================== */

const globalForTracing = globalThis as unknown as {
  __cbTraces?: Map<string, Span[]>;
  __cbActiveSpans?: Map<string, string>; // traceId → current spanId
};

if (!globalForTracing.__cbTraces) {
  globalForTracing.__cbTraces = new Map();
}
if (!globalForTracing.__cbActiveSpans) {
  globalForTracing.__cbActiveSpans = new Map();
}

const traces = globalForTracing.__cbTraces!;
const activeSpans = globalForTracing.__cbActiveSpans!;

// Cleanup old traces every 5 minutes
const traceCleanup = setInterval(() => {
  const cutoff = Date.now() - 600_000; // 10 min
  for (const [traceId, spans] of traces) {
    const newest = spans.reduce((max, s) => Math.max(max, s.startTime), 0);
    if (newest < cutoff) {
      traces.delete(traceId);
      activeSpans.delete(traceId);
    }
  }
}, 300_000);
if (traceCleanup.unref) traceCleanup.unref();

/* ================================================================== */
/*  Span ID generation                                                 */
/* ================================================================== */

let spanCounter = 0;
function generateSpanId(): string {
  return `span_${Date.now().toString(36)}_${(++spanCounter).toString(36)}`;
}

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

/**
 * Start a new span within the current request trace.
 *
 * Usage:
 * ```ts
 * const span = startSpan("db.findJobs", { query: "engineering" });
 * try {
 *   const jobs = await prisma.job.findMany(...);
 *   span.setAttribute("resultCount", jobs.length);
 *   span.end();
 *   return jobs;
 * } catch (err) {
 *   span.setError(err);
 *   span.end();
 *   throw err;
 * }
 * ```
 */
export function startSpan(
  name: string,
  attributes: Record<string, string | number | boolean> = {},
  service?: string,
): SpanHandle {
  const traceId = getRequestId() || `trace_${Date.now().toString(36)}`;
  const parentId = activeSpans.get(traceId);
  const spanId = generateSpanId();

  const span: Span = {
    id: spanId,
    traceId,
    parentId,
    name,
    service: service || "app",
    startTime: Date.now(),
    status: "ok",
    attributes: { ...attributes },
    events: [],
  };

  // Register span
  let traceSpans = traces.get(traceId);
  if (!traceSpans) {
    traceSpans = [];
    traces.set(traceId, traceSpans);
  }
  traceSpans.push(span);

  // Set as active (for nesting)
  activeSpans.set(traceId, spanId);

  return new SpanHandle(span, parentId);
}

/**
 * Convenience: wrap an async function in a span.
 *
 * Usage:
 * ```ts
 * const result = await withSpan("db.findJobs", async (span) => {
 *   const jobs = await prisma.job.findMany();
 *   span.setAttribute("count", jobs.length);
 *   return jobs;
 * });
 * ```
 */
export async function withSpan<T>(
  name: string,
  fn: (span: SpanHandle) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  const span = startSpan(name, attributes);
  try {
    const result = await fn(span);
    span.end();
    return result;
  } catch (err) {
    span.setError(err);
    span.end();
    throw err;
  }
}

/**
 * Get the complete trace for a request.
 */
export function getTrace(traceId: string): Span[] {
  return traces.get(traceId) || [];
}

/**
 * Get the current request's trace.
 */
export function getCurrentTrace(): Span[] {
  const traceId = getRequestId();
  if (!traceId) return [];
  return traces.get(traceId) || [];
}

/* ================================================================== */
/*  Span Handle                                                        */
/* ================================================================== */

export class SpanHandle {
  private span: Span;
  private parentId: string | undefined;

  constructor(span: Span, parentId: string | undefined) {
    this.span = span;
    this.parentId = parentId;
  }

  /** Add an attribute to the span. */
  setAttribute(key: string, value: string | number | boolean): this {
    this.span.attributes[key] = value;
    return this;
  }

  /** Add an event (milestone) to the span. */
  addEvent(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): this {
    this.span.events.push({ name, timestamp: Date.now(), attributes });
    return this;
  }

  /** Mark the span as errored. */
  setError(err: unknown): this {
    this.span.status = "error";
    this.span.attributes["error.message"] =
      err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.stack) {
      this.span.attributes["error.stack"] = err.stack.split("\n").slice(0, 3).join(" | ");
    }
    return this;
  }

  /** End the span and record duration. */
  end(): void {
    this.span.endTime = Date.now();
    this.span.durationMs = this.span.endTime - this.span.startTime;

    // Restore parent as active span
    if (this.parentId) {
      activeSpans.set(this.span.traceId, this.parentId);
    } else {
      activeSpans.delete(this.span.traceId);
    }

    // Record duration metric
    metrics.observe("span_duration_ms", this.span.durationMs, {
      name: this.span.name,
      status: this.span.status,
    });

    // Log slow spans
    if (this.span.durationMs > 1000) {
      logger.warn("slow_span", {
        spanId: this.span.id,
        traceId: this.span.traceId,
        name: this.span.name,
        duration: this.span.durationMs,
      });
    }

    // Log errors
    if (this.span.status === "error") {
      logger.error("span_error", {
        spanId: this.span.id,
        traceId: this.span.traceId,
        name: this.span.name,
        duration: this.span.durationMs,
        error: String(this.span.attributes["error.message"]),
      });
    }
  }

  /** Get the span data. */
  getData(): Readonly<Span> {
    return this.span;
  }
}
