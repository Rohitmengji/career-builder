/*
 * Lightweight Background Job Queue — zero-cost, in-process.
 *
 * Provides:
 *   - Named job types with typed payloads
 *   - Automatic retry with exponential backoff
 *   - Concurrency control (1 at a time by default)
 *   - Dead-letter tracking for failed jobs
 *   - Memory-safe with max queue size
 *
 * Use cases:
 *   - Webhook retries
 *   - Email sending (future)
 *   - AI batch processing (future)
 *   - Audit log flushing
 *
 * NOTE: This is in-process only. Jobs are lost on restart.
 * For persistent jobs, migrate to a DB-backed queue or BullMQ.
 */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: number;
}

export interface JobResult {
  success: boolean;
  error?: string;
}

export type JobHandler<T = unknown> = (payload: T) => Promise<void>;

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
}

/* ================================================================== */
/*  Queue Implementation                                               */
/* ================================================================== */

const MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 5000, 15000, 30000, 60000]; // ms

class BackgroundQueue {
  private queue: Job[] = [];
  private deadLetter: Job[] = [];
  private handlers = new Map<string, JobHandler>();
  private processing = false;
  private stats = { completed: 0, failed: 0, processing: 0 };
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Process queue every second
    this.timer = setInterval(() => this.processNext(), 1000);
    if (typeof this.timer === "object" && this.timer && "unref" in this.timer) {
      (this.timer as NodeJS.Timeout).unref();
    }
  }

  /**
   * Register a handler for a job type.
   */
  register<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Enqueue a new job. Returns job ID.
   */
  enqueue<T>(type: string, payload: T, maxAttempts = DEFAULT_MAX_ATTEMPTS): string {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn(`[jobs] Queue full (${MAX_QUEUE_SIZE}). Dropping oldest job.`);
      this.queue.shift();
    }

    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.queue.push({
      id,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts,
    });

    return id;
  }

  /**
   * Process the next job in the queue.
   */
  private async processNext(): Promise<void> {
    if (this.processing) return;

    const now = Date.now();
    const jobIndex = this.queue.findIndex(
      (j) => !j.nextRetryAt || now >= j.nextRetryAt,
    );
    if (jobIndex === -1) return;

    const job = this.queue.splice(jobIndex, 1)[0]!;
    const handler = this.handlers.get(job.type);

    if (!handler) {
      console.warn(`[jobs] No handler for job type: ${job.type}`);
      this.deadLetter.push({ ...job, lastError: "No handler registered" });
      return;
    }

    this.processing = true;
    this.stats.processing = 1;
    job.attempts++;

    try {
      await handler(job.payload);
      this.stats.completed++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      job.lastError = errorMsg;

      if (job.attempts < job.maxAttempts) {
        // Schedule retry with exponential backoff
        const delay = RETRY_DELAYS[Math.min(job.attempts - 1, RETRY_DELAYS.length - 1)]!;
        job.nextRetryAt = Date.now() + delay;
        this.queue.push(job);
        console.warn(
          `[jobs] Job ${job.id} (${job.type}) failed (attempt ${job.attempts}/${job.maxAttempts}). Retrying in ${delay}ms.`,
        );
      } else {
        // Max attempts reached — move to dead letter
        this.deadLetter.push(job);
        this.stats.failed++;
        console.error(
          `[jobs] Job ${job.id} (${job.type}) permanently failed after ${job.maxAttempts} attempts: ${errorMsg}`,
        );
      }
    } finally {
      this.processing = false;
      this.stats.processing = 0;
    }
  }

  /**
   * Get queue statistics.
   */
  getStats(): QueueStats {
    return {
      pending: this.queue.length,
      processing: this.stats.processing,
      completed: this.stats.completed,
      failed: this.stats.failed,
      deadLetter: this.deadLetter.length,
    };
  }

  /**
   * Get dead letter queue (failed jobs).
   */
  getDeadLetter(): Job[] {
    return [...this.deadLetter];
  }

  /**
   * Retry all dead letter jobs.
   */
  retryDeadLetter(): number {
    const count = this.deadLetter.length;
    for (const job of this.deadLetter) {
      job.attempts = 0;
      job.nextRetryAt = undefined;
      this.queue.push(job);
    }
    this.deadLetter = [];
    return count;
  }

  /**
   * Clear dead letter queue.
   */
  clearDeadLetter(): void {
    this.deadLetter = [];
  }

  /**
   * Drain — wait for all jobs to complete (for graceful shutdown).
   */
  async drain(timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (this.queue.length > 0 || this.processing) {
      if (Date.now() - start > timeoutMs) {
        console.warn(`[jobs] Drain timed out with ${this.queue.length} jobs remaining.`);
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/* ================================================================== */
/*  Singleton export — survives hot reload                             */
/* ================================================================== */

const globalForQueue = globalThis as unknown as {
  __jobQueue: BackgroundQueue | undefined;
};

export const jobQueue = globalForQueue.__jobQueue ?? new BackgroundQueue();

if (process.env.NODE_ENV !== "production") {
  globalForQueue.__jobQueue = jobQueue;
}
