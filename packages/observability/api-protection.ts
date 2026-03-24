/*
 * @career-builder/observability — API Abuse Protection
 *
 * Defense layers:
 *   1. Payload size limits (prevent memory exhaustion)
 *   2. Request timeout enforcement
 *   3. Malformed request rejection
 *   4. Slow-loris protection (connection time limits)
 *   5. JSON depth / key count limits
 *
 * Use alongside rate limiting and bot detection.
 */

import { NextResponse } from "next/server";
import { getLogger } from "./logger";
import { metrics, METRIC } from "./metrics";
import { getRequestId } from "./correlation";

const logger = getLogger("api-protection");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface ApiProtectionConfig {
  /** Max request body size in bytes (default: 1MB) */
  maxBodySize?: number;
  /** Max JSON depth (default: 10) */
  maxJsonDepth?: number;
  /** Max number of keys in JSON object (default: 500) */
  maxJsonKeys?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Required content-type for POST/PUT/PATCH (default: application/json) */
  requiredContentType?: string;
}

/* ================================================================== */
/*  JSON depth / key analysis                                          */
/* ================================================================== */

function analyzeJson(
  obj: unknown,
  maxDepth: number,
  maxKeys: number,
  currentDepth = 0,
): { valid: boolean; reason?: string } {
  if (currentDepth > maxDepth) {
    return { valid: false, reason: `JSON depth exceeds limit of ${maxDepth}` };
  }

  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>);
    if (keys.length > maxKeys) {
      return { valid: false, reason: `JSON key count ${keys.length} exceeds limit of ${maxKeys}` };
    }

    for (const key of keys) {
      const result = analyzeJson(
        (obj as Record<string, unknown>)[key],
        maxDepth,
        maxKeys,
        currentDepth + 1,
      );
      if (!result.valid) return result;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = analyzeJson(item, maxDepth, maxKeys, currentDepth + 1);
        if (!result.valid) return result;
      }
    }
  }

  return { valid: true };
}

/* ================================================================== */
/*  Protection functions                                               */
/* ================================================================== */

const DEFAULTS: Required<ApiProtectionConfig> = {
  maxBodySize: 1_048_576, // 1 MB
  maxJsonDepth: 10,
  maxJsonKeys: 500,
  timeoutMs: 30_000,
  requiredContentType: "application/json",
};

/**
 * Validate an incoming request body against abuse limits.
 * Returns null if the request is valid, or an error Response if not.
 */
export async function validateRequestBody(
  req: Request,
  config: ApiProtectionConfig = {},
): Promise<{ body: unknown; error: Response | null }> {
  const cfg = { ...DEFAULTS, ...config };

  // ── Content-Type check ──────────────────────────────────────
  const contentType = req.headers.get("content-type");
  if (cfg.requiredContentType && contentType) {
    if (!contentType.includes(cfg.requiredContentType)) {
      logger.warn("invalid_content_type", {
        contentType,
        expected: cfg.requiredContentType,
        requestId: getRequestId(),
      });
      return {
        body: null,
        error: NextResponse.json(
          { error: "Invalid content type" },
          { status: 415 },
        ),
      };
    }
  }

  // ── Content-Length check ─────────────────────────────────────
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > cfg.maxBodySize) {
      logger.warn("payload_too_large", {
        size,
        limit: cfg.maxBodySize,
        requestId: getRequestId(),
      });
      return {
        body: null,
        error: NextResponse.json(
          { error: "Payload too large" },
          { status: 413 },
        ),
      };
    }
  }

  // ── Parse body ──────────────────────────────────────────────
  let body: unknown;
  try {
    const text = await req.text();

    // Double-check actual size
    if (text.length > cfg.maxBodySize) {
      return {
        body: null,
        error: NextResponse.json(
          { error: "Payload too large" },
          { status: 413 },
        ),
      };
    }

    body = JSON.parse(text);
  } catch {
    logger.warn("malformed_json", { requestId: getRequestId() });
    return {
      body: null,
      error: NextResponse.json(
        { error: "Malformed JSON" },
        { status: 400 },
      ),
    };
  }

  // ── JSON structure analysis ─────────────────────────────────
  const analysis = analyzeJson(body, cfg.maxJsonDepth, cfg.maxJsonKeys);
  if (!analysis.valid) {
    logger.warn("json_abuse_detected", {
      reason: analysis.reason,
      requestId: getRequestId(),
    });
    return {
      body: null,
      error: NextResponse.json(
        { error: analysis.reason },
        { status: 400 },
      ),
    };
  }

  return { body, error: null };
}

/**
 * Wrap an async handler with a timeout.
 * If the handler doesn't resolve within `timeoutMs`, returns a 504 response.
 */
export async function withTimeout(
  handler: () => Promise<Response>,
  timeoutMs = DEFAULTS.timeoutMs,
): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await Promise.race([
      handler(),
      new Promise<Response>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          logger.error("request_timeout", {
            timeoutMs,
            requestId: getRequestId(),
          });
          reject(new Error("Request timeout"));
        });
      }),
    ]);

    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.message === "Request timeout") {
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 504 },
      );
    }
    throw err;
  }
}
