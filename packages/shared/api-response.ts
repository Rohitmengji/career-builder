/*
 * API Error Wrapper — Production-grade API response helpers.
 *
 * Provides:
 *   - Consistent JSON error format: { success: false, error: string, code?: string }
 *   - Consistent success format: { success: true, data: T }
 *   - Try/catch wrapper for route handlers
 *   - Error classification (client vs server errors)
 *   - Safe error messages (no stack traces in production)
 */

import { NextResponse } from "next/server";

/* ================================================================== */
/*  Response Types                                                     */
/* ================================================================== */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/* ================================================================== */
/*  Response helpers                                                   */
/* ================================================================== */

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(
  error: string,
  status = 500,
  code?: string,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, error, ...(code && { code }) },
    { status },
  );
}

export function apiBadRequest(error: string, code?: string) {
  return apiError(error, 400, code || "BAD_REQUEST");
}

export function apiUnauthorized(error = "Unauthorized") {
  return apiError(error, 401, "UNAUTHORIZED");
}

export function apiForbidden(error = "Forbidden") {
  return apiError(error, 403, "FORBIDDEN");
}

export function apiNotFound(error = "Not found") {
  return apiError(error, 404, "NOT_FOUND");
}

export function apiRateLimit(retryAfterSeconds = 60) {
  return NextResponse.json(
    { success: false, error: "Too many requests", code: "RATE_LIMITED" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

/* ================================================================== */
/*  Route handler wrapper                                              */
/* ================================================================== */

type RouteHandler = (
  request: Request,
  context?: { params?: Promise<Record<string, string>> },
) => Promise<NextResponse | Response>;

/**
 * Wraps an API route handler with try/catch error handling.
 *
 * @example
 * export const GET = withApiHandler(async (request) => {
 *   const data = await fetchData();
 *   return apiSuccess(data);
 * });
 */
export function withApiHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error: unknown) {
      // Log the full error server-side
      console.error("[api-error]", {
        method: request.method,
        url: request.url,
        error: error instanceof Error ? error.message : "Unknown error",
        stack:
          process.env.NODE_ENV !== "production" && error instanceof Error
            ? error.stack
            : undefined,
      });

      // Return safe error to client
      const message =
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      return apiError(message, 500, "INTERNAL_ERROR");
    }
  };
}

/* ================================================================== */
/*  Validation helper (Zod integration)                                */
/* ================================================================== */

/**
 * Validate request body with a Zod schema.
 * Returns parsed data or throws an error that withApiHandler catches.
 */
export async function parseBody<T>(
  request: Request,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiValidationError("Invalid JSON body");
  }

  try {
    return schema.parse(body);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "issues" in error) {
      const issues = (error as { issues: Array<{ message: string; path: (string | number)[] }> }).issues;
      const msg = issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new ApiValidationError(msg);
    }
    throw new ApiValidationError("Validation failed");
  }
}

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiValidationError";
  }
}
