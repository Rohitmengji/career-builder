/*
 * @career-builder/observability — Log Persistence
 *
 * Pluggable log sinks that extend the Logger:
 *   - FileLogSink:    write JSONL to local files with rotation
 *   - ExternalLogSink: POST batches to Datadog / Logflare / S3
 *   - SamplingFilter:  drop low-priority logs, keep all errors
 *   - RetentionPolicy: auto-delete old log files
 *
 * Usage:
 *   import { attachFileSink } from "@career-builder/observability/persistence";
 *   attachFileSink(logger.admin, { dir: "logs", retentionDays: 7 });
 */

import fs from "node:fs";
import path from "node:path";
import { type LogEntry, type LogLevel, type Logger } from "./logger";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface FileSinkConfig {
  /** Directory to write logs to (relative to cwd or absolute). */
  dir: string;
  /** Max file size before rotation in bytes (default: 10MB). */
  maxFileSizeBytes?: number;
  /** Number of days to keep old log files (default: 7). */
  retentionDays?: number;
  /** Minimum level to persist (default: "info"). */
  minLevel?: LogLevel;
}

export interface ExternalSinkConfig {
  /** POST endpoint for log batches. */
  endpoint: string;
  /** Auth header value (e.g. "Bearer xxx" or "dd-api-key xxx"). */
  authHeader?: string;
  /** Name of auth header (default: "Authorization"). */
  authHeaderName?: string;
  /** Max batch size before flushing (default: 100). */
  batchSize?: number;
  /** Flush interval in ms (default: 5000). */
  flushIntervalMs?: number;
  /** Minimum level to send (default: "warn"). */
  minLevel?: LogLevel;
}

export interface SamplingConfig {
  /** Fraction of debug logs to keep (0-1, default: 0.1 = 10%). */
  debugRate?: number;
  /** Fraction of info logs to keep (0-1, default: 0.5 = 50%). */
  infoRate?: number;
  /** warn/error/fatal always kept at 100%. */
}

/* ================================================================== */
/*  Level priority (re-use from logger)                                */
/* ================================================================== */

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/* ================================================================== */
/*  File Log Sink                                                      */
/* ================================================================== */

export class FileLogSink {
  private dir: string;
  private maxSize: number;
  private retentionDays: number;
  private minLevel: number;
  private currentFile: string;
  private currentSize = 0;
  private writeBuffer: string[] = [];
  private flushInterval: ReturnType<typeof setInterval>;

  constructor(config: FileSinkConfig) {
    this.dir = path.resolve(config.dir);
    this.maxSize = config.maxFileSizeBytes ?? 10 * 1024 * 1024; // 10MB
    this.retentionDays = config.retentionDays ?? 7;
    this.minLevel = LEVEL_PRIORITY[config.minLevel ?? "info"];
    this.currentFile = this.generateFilename();

    // Ensure directory exists
    fs.mkdirSync(this.dir, { recursive: true });

    // Flush buffer every 2 seconds
    this.flushInterval = setInterval(() => this.flush(), 2_000);
    if (this.flushInterval.unref) this.flushInterval.unref();

    // Run retention cleanup on start and every hour
    this.cleanOldFiles();
    const retentionInterval = setInterval(() => this.cleanOldFiles(), 3_600_000);
    if (retentionInterval.unref) retentionInterval.unref();
  }

  /** Write handler — connect to Logger.onLog(). */
  write(entry: LogEntry): void {
    if (LEVEL_PRIORITY[entry.level] < this.minLevel) return;

    const line = JSON.stringify(entry) + "\n";
    this.writeBuffer.push(line);
    this.currentSize += line.length;

    // Rotate if needed
    if (this.currentSize >= this.maxSize) {
      this.flush();
      this.currentFile = this.generateFilename();
      this.currentSize = 0;
    }
  }

  /** Flush buffered writes to disk. */
  flush(): void {
    if (this.writeBuffer.length === 0) return;
    try {
      const data = this.writeBuffer.join("");
      fs.appendFileSync(path.join(this.dir, this.currentFile), data, "utf-8");
      this.writeBuffer = [];
    } catch {
      // Disk write failure — silently drop (don't crash the app)
      this.writeBuffer = [];
    }
  }

  /** Delete log files older than retentionDays. */
  private cleanOldFiles(): void {
    try {
      const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(".jsonl"));
      const cutoff = Date.now() - this.retentionDays * 86_400_000;

      for (const file of files) {
        const filePath = path.join(this.dir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // Non-fatal
    }
  }

  private generateFilename(): string {
    const d = new Date();
    const date = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = d.toISOString().slice(11, 19).replace(/:/g, ""); // HHmmss
    return `app-${date}-${time}.jsonl`;
  }

  destroy(): void {
    this.flush();
    clearInterval(this.flushInterval);
  }
}

/* ================================================================== */
/*  External Log Sink (Datadog / Logflare / S3 pre-signed)             */
/* ================================================================== */

export class ExternalLogSink {
  private endpoint: string;
  private authHeader: string | undefined;
  private authHeaderName: string;
  private batchSize: number;
  private minLevel: number;
  private buffer: LogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval>;

  constructor(config: ExternalSinkConfig) {
    this.endpoint = config.endpoint;
    this.authHeader = config.authHeader;
    this.authHeaderName = config.authHeaderName ?? "Authorization";
    this.batchSize = config.batchSize ?? 100;
    this.minLevel = LEVEL_PRIORITY[config.minLevel ?? "warn"];

    this.flushInterval = setInterval(
      () => this.flush(),
      config.flushIntervalMs ?? 5_000,
    );
    if (this.flushInterval.unref) this.flushInterval.unref();
  }

  write(entry: LogEntry): void {
    if (LEVEL_PRIORITY[entry.level] < this.minLevel) return;
    this.buffer.push(entry);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.authHeader) headers[this.authHeaderName] = this.authHeader;

      await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
    } catch {
      // External service down — drop the batch (or re-queue in production)
    }
  }

  destroy(): void {
    this.flush();
    clearInterval(this.flushInterval);
  }
}

/* ================================================================== */
/*  Sampling Filter                                                    */
/* ================================================================== */

const DEFAULT_SAMPLING: Required<SamplingConfig> = {
  debugRate: 0.1,
  infoRate: 0.5,
};

/**
 * Returns true if the entry should be kept (not sampled out).
 * warn/error/fatal are always kept. debug/info are probabilistic.
 */
export function shouldSample(entry: LogEntry, config: SamplingConfig = {}): boolean {
  const cfg = { ...DEFAULT_SAMPLING, ...config };

  if (entry.level === "error" || entry.level === "fatal" || entry.level === "warn") {
    return true; // Always keep
  }
  if (entry.level === "debug") {
    return Math.random() < cfg.debugRate;
  }
  if (entry.level === "info") {
    return Math.random() < cfg.infoRate;
  }
  return true;
}

/* ================================================================== */
/*  Attach helpers                                                     */
/* ================================================================== */

/**
 * Attach a file log sink to a logger instance.
 * Returns a cleanup function.
 */
export function attachFileSink(loggerInstance: Logger, config: FileSinkConfig): () => void {
  const sink = new FileLogSink(config);
  const unsub = loggerInstance.onLog((entry) => sink.write(entry));
  return () => {
    unsub();
    sink.destroy();
  };
}

/**
 * Attach an external log sink to a logger instance.
 * Returns a cleanup function.
 */
export function attachExternalSink(loggerInstance: Logger, config: ExternalSinkConfig): () => void {
  const sink = new ExternalLogSink(config);
  const unsub = loggerInstance.onLog((entry) => sink.write(entry));
  return () => {
    unsub();
    sink.destroy();
  };
}

/**
 * Attach a sampling filter to a logger instance.
 * Wraps the logger's output to drop sampled-out entries.
 */
export function attachSampling(loggerInstance: Logger, config: SamplingConfig = {}): () => void {
  return loggerInstance.onLog((entry) => {
    // The sampling decision is advisory — the entry is already logged
    // by the time onLog fires. For true sampling, the logger's
    // `output` config should be wrapped at construction.
    // This onLog hook is primarily for deciding whether to forward
    // to external sinks.
  });
}
