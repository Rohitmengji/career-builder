/*
 * @career-builder/observability — Sentry Integration
 *
 * Provides a lightweight Sentry error-capture shim.
 * When SENTRY_DSN is set, errors are sent to Sentry with
 * tenant/user/route context. Otherwise, falls back to
 * structured logging only.
 *
 * To fully enable Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Set SENTRY_DSN in .env
 *   3. Run `npx @sentry/wizard@latest -i nextjs` for instrumentation
 *
 * This module works without @sentry/nextjs installed — it
 * dynamically imports it and degrades gracefully.
 */

import { getLogger } from "./logger";
import { getRequestContext } from "./correlation";

const logger = getLogger("sentry");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface SentryContext {
  tenantId?: string;
  userId?: string;
  route?: string;
  requestId?: string;
  [key: string]: unknown;
}

/* ================================================================== */
/*  Error capture                                                      */
/* ================================================================== */

let sentryAvailable: boolean | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSentry(): Promise<any | null> {
  if (sentryAvailable === false) return null;
  try {
    // Dynamic import — works even if @sentry/nextjs is not installed.
    // Using a variable to prevent Next.js from resolving this at build time.
    const pkg = "@sentry/nextjs";
    // @ts-ignore Optional peer dependency
    const sentry = await import(/* webpackIgnore: true */ pkg);
    sentryAvailable = true;
    return sentry;
  } catch {
    sentryAvailable = false;
    return null;
  }
}

/**
 * Capture an error with context. Sends to Sentry if available,
 * always logs structurally.
 */
export async function captureError(
  error: Error | string,
  context: SentryContext = {},
): Promise<void> {
  const err = typeof error === "string" ? new Error(error) : error;
  const reqCtx = getRequestContext();

  const fullContext: SentryContext = {
    ...context,
    requestId: reqCtx?.requestId || context.requestId,
    tenantId: reqCtx?.tenantId || context.tenantId,
    userId: reqCtx?.userId || context.userId,
    route: reqCtx?.route || context.route,
  };

  // Always log
  logger.error("captured_error", {
    error: err.message,
    stack: err.stack?.split("\n").slice(0, 5).join("\n"),
    ...fullContext,
  });

  // Send to Sentry if available
  const sentry = await getSentry();
  if (sentry) {
    sentry.withScope((scope: any) => {
      if (fullContext.tenantId) scope.setTag("tenantId", fullContext.tenantId);
      if (fullContext.userId) scope.setUser({ id: fullContext.userId });
      if (fullContext.requestId) scope.setTag("requestId", fullContext.requestId);
      if (fullContext.route) scope.setTag("route", fullContext.route);
      scope.setExtras(fullContext);
      sentry.captureException(err);
    });
  }
}

/**
 * Capture a message (non-error event) to Sentry.
 */
export async function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context: SentryContext = {},
): Promise<void> {
  logger.info("captured_message", { message, level, ...context });

  const sentry = await getSentry();
  if (sentry) {
    sentry.withScope((scope: any) => {
      if (context.tenantId) scope.setTag("tenantId", context.tenantId);
      if (context.userId) scope.setUser({ id: context.userId });
      scope.setExtras(context);
      sentry.captureMessage(message, level);
    });
  }
}

/**
 * Initialize Sentry (call in your app's instrumentation file).
 * No-op if SENTRY_DSN is not set or @sentry/nextjs is not installed.
 */
export async function initSentry(options?: {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
}): Promise<void> {
  const dsn = options?.dsn || process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("sentry_skip", {}, "SENTRY_DSN not set — Sentry disabled");
    return;
  }

  const sentry = await getSentry();
  if (!sentry) {
    logger.warn("sentry_not_installed", {}, "Install @sentry/nextjs to enable Sentry");
    return;
  }

  sentry.init({
    dsn,
    environment: options?.environment || process.env.NODE_ENV || "development",
    tracesSampleRate: options?.tracesSampleRate ?? 0.1,
  });

  logger.info("sentry_initialized", { dsn: dsn.slice(0, 30) + "..." });
}
