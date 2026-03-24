/*
 * @career-builder/observability — Correlation IDs
 *
 * Assigns a unique requestId to every incoming request.
 * The ID is propagated through logs, API calls, and headers
 * so you can trace a single user action across the entire system.
 *
 * Uses AsyncLocalStorage for zero-prop-drilling context propagation.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface RequestContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  route?: string;
  method?: string;
  ip?: string;
  startTime: number;
  userAgent?: string;
}

/* ================================================================== */
/*  AsyncLocalStorage for request context                              */
/* ================================================================== */

const storage = new AsyncLocalStorage<RequestContext>();

/** Get the current request context (null if outside a request). */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Get the current correlation / request ID. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Generate a unique request ID (k-sortable for log ordering). */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString("hex");
  return `req_${timestamp}_${random}`;
}

/**
 * Run a function within a request context.
 * All calls to getRequestContext() / getRequestId() inside `fn`
 * will return the values from `ctx`.
 */
export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Create a RequestContext from an incoming request.
 */
export function createRequestContext(
  request: Request,
  overrides?: Partial<RequestContext>,
): RequestContext {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";

  return {
    requestId:
      request.headers.get("x-request-id") ||
      overrides?.requestId ||
      generateRequestId(),
    tenantId:
      request.headers.get("x-tenant-id") ||
      overrides?.tenantId,
    route: url.pathname,
    method: request.method,
    ip,
    userAgent: request.headers.get("user-agent") || undefined,
    startTime: Date.now(),
    ...overrides,
  };
}

/** Header name for propagating request IDs across services. */
export const REQUEST_ID_HEADER = "x-request-id";
