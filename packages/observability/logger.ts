/*
 * @career-builder/observability — Structured Logger
 *
 * Production-grade JSON structured logging with:
 *   - Log levels: debug, info, warn, error, fatal
 *   - Correlation IDs for request tracing
 *   - Automatic PII redaction
 *   - Tenant + user context
 *   - Timestamped, machine-parseable output
 *
 * Output goes to stdout/stderr for container-friendly logging.
 * In production, pipe to Datadog / ELK / CloudWatch.
 */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  service: string;
  environment: string;
  context: LogContext;
  message?: string;
}

/* ================================================================== */
/*  PII Redaction                                                      */
/* ================================================================== */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "sessionToken",
  "creditCard",
  "ssn",
  "apiKey",
  "accessToken",
  "refreshToken",
  "x-csrf-token",
]);

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string" && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else {
      result[key] = redactValue(key, value);
    }
  }
  return result;
}

/** Redact emails from a string (for log messages). */
function redactEmails(str: string): string {
  return str.replace(EMAIL_RE, (match) => {
    const [local, domain] = match.split("@");
    return `${local[0]}***@${domain}`;
  });
}

/* ================================================================== */
/*  Logger Class                                                       */
/* ================================================================== */

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface LoggerConfig {
  service: string;
  minLevel?: LogLevel;
  enableRedaction?: boolean;
  /** Custom output handler (default: console) */
  output?: (entry: LogEntry) => void;
}

export class Logger {
  private service: string;
  private minLevel: number;
  private enableRedaction: boolean;
  private environment: string;
  private output: (entry: LogEntry) => void;

  /** Listeners for alerts / anomaly detection */
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.minLevel = LOG_LEVEL_PRIORITY[config.minLevel ?? "info"];
    this.enableRedaction = config.enableRedaction ?? true;
    this.environment = process.env.NODE_ENV || "development";
    this.output = config.output ?? this.defaultOutput.bind(this);
  }

  /** Subscribe to log entries (for alerting / anomaly detection). */
  onLog(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  debug(event: string, context: LogContext = {}, message?: string) {
    this.log("debug", event, context, message);
  }

  info(event: string, context: LogContext = {}, message?: string) {
    this.log("info", event, context, message);
  }

  warn(event: string, context: LogContext = {}, message?: string) {
    this.log("warn", event, context, message);
  }

  error(event: string, context: LogContext = {}, message?: string) {
    this.log("error", event, context, message);
  }

  fatal(event: string, context: LogContext = {}, message?: string) {
    this.log("fatal", event, context, message);
  }

  /** Create a child logger with pre-filled context. */
  child(baseContext: LogContext): ChildLogger {
    return new ChildLogger(this, baseContext);
  }

  /** Internal log method. */
  log(level: LogLevel, event: string, context: LogContext = {}, message?: string) {
    if (LOG_LEVEL_PRIORITY[level] < this.minLevel) return;

    const sanitizedContext = this.enableRedaction
      ? (redactObject(context as Record<string, unknown>) as LogContext)
      : context;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      service: this.service,
      environment: this.environment,
      context: sanitizedContext,
      ...(message ? { message: this.enableRedaction ? redactEmails(message) : message } : {}),
    };

    this.output(entry);

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Don't let listener errors break logging
      }
    }
  }

  private defaultOutput(entry: LogEntry) {
    const json = JSON.stringify(entry);
    if (entry.level === "error" || entry.level === "fatal") {
      console.error(json);
    } else if (entry.level === "warn") {
      console.warn(json);
    } else {
      console.log(json);
    }
  }
}

/* ================================================================== */
/*  Child Logger (pre-filled context)                                  */
/* ================================================================== */

class ChildLogger {
  constructor(
    private parent: Logger,
    private baseContext: LogContext,
  ) {}

  debug(event: string, context: LogContext = {}, message?: string) {
    this.parent.log("debug", event, { ...this.baseContext, ...context }, message);
  }
  info(event: string, context: LogContext = {}, message?: string) {
    this.parent.log("info", event, { ...this.baseContext, ...context }, message);
  }
  warn(event: string, context: LogContext = {}, message?: string) {
    this.parent.log("warn", event, { ...this.baseContext, ...context }, message);
  }
  error(event: string, context: LogContext = {}, message?: string) {
    this.parent.log("error", event, { ...this.baseContext, ...context }, message);
  }
  fatal(event: string, context: LogContext = {}, message?: string) {
    this.parent.log("fatal", event, { ...this.baseContext, ...context }, message);
  }
}

/* ================================================================== */
/*  Singleton instances                                                */
/* ================================================================== */

const globalForLoggers = globalThis as unknown as {
  __cbLoggers?: Map<string, Logger>;
};

if (!globalForLoggers.__cbLoggers) {
  globalForLoggers.__cbLoggers = new Map();
}

/** Get or create a logger for a service. */
export function getLogger(service: string, config?: Partial<LoggerConfig>): Logger {
  let logger = globalForLoggers.__cbLoggers!.get(service);
  if (!logger) {
    logger = new Logger({ service, ...config });
    globalForLoggers.__cbLoggers!.set(service, logger);
  }
  return logger;
}

/** Pre-configured loggers for each app. */
export const logger = {
  admin: getLogger("admin"),
  web: getLogger("web"),
  api: getLogger("api"),
  db: getLogger("database"),
  security: getLogger("security"),
};
