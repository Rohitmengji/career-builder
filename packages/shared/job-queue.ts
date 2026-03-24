/*
 * Lightweight In-Process Job Queue
 *
 * Zero-cost background task system for:
 *   - Webhook retries
 *   - Email sending (future)
 *   - AI processing deferred tasks
 *   - Audit log cleanup
 *
 * Runs entirely in-process — no Redis, no external queue.
 * Jobs are volatile (lost on restart) — only for non-critical async work.
 * For critical operations, use direct DB writes instead.
 *
 * Design:
 *   - FIFO queue with configurable concurrency (default: 2)
 *   - Automatic retry with exponential backoff (3 attempts)
 *   - Dead letter tracking for failed jobs
 *   - Memory-bounded (max 1000 pending jobs)
 *   - Graceful drain on process shutdown
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
}

export interface JobHandler<T = unknown> {
  (payload: T): Promise<void>;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetterCount: number;
}

/* ================================================================== */
/*  Implementation                                                     */
/* ================================================================== */

const MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // ms

class JobQueue {
  private queue: Job[] = [];
  private processing = 0;
  private concurrency: number;
  private handlers = new Map<string, JobHandler<any>>();
  private completed = 0;
  private failed = 0;
  private deadLetter: Job[] = [];
  private draining = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }

  /**
   * Register a handler for a job type.
   * @example queue.register("send-email", async (payload) => { ... });
   */
  register<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler<any>);
  }

  /**
   * Enqueue a job for background processing.
   * Returns false if queue is full (back-pressure).
   */
  enqueue<T>(type: string, payload: T, maxAttempts = DEFAULT_MAX_ATTEMPTS): boolean {
    if (this.draining) return false;
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn(`[job-queue] Queue full (${MAX_QUEUE_SIZE}), dropping job: ${type}`);
      return false;
    }
    if (!this.handlers.has(type)) {
      console.warn(`[job-queue] No handler registered for type: ${type}`);
      return false;
    }

    const job: Job<T> = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts,
    };

    this.queue.push(job);
    this.tick();
    return true;
  }

  /**
   * Process next jobs up to concurrency limit.
   */
  private tick(): void {
    while (this.processing < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.processing++;
      this.processJob(job).finally(() => {
        this.processing--;
        // Process next after current finishes
        if (this.queue.length > 0) this.tick();
      });
    }
  }

  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.failed++;
      return;
    }

    job.attempts++;

    try {
      await handler(job.payload);
      this.completed++;
    } catch (err: any) {
      job.lastError = err.message || String(err);

      if (job.attempts < job.maxAttempts) {
        // Schedule retry with backoff
        const delay = RETRY_DELAYS[Math.min(job.attempts - 1, RETRY_DELAYS.length - 1)]!;
        this.timer = setTimeout(() => {
          this.queue.push(job);
          this.tick();
        }, delay);
        if (typeof this.timer === "object" && this.timer && "unref" in this.timer) {
          (this.timer as NodeJS.Timeout).unref();
        }
      } else {
        // Move to dead letter queue
        this.failed++;
        this.deadLetter.push(job);
        // Cap dead letter size
        if (this.deadLetter.length > 100) {
          this.deadLetter = this.deadLetter.slice(-100);
        }
        console.error(`[job-queue] Job failed permanently: ${job.type} (${job.id}) — ${job.lastError}`);
      }
    }
  }

  /** Get queue statistics */
  stats(): QueueStats {
    return {
      pending: this.queue.length,
      processing: this.processing,
      completed: this.completed,
      failed: this.failed,
      deadLetterCount: this.deadLetter.length,
    };
  }

  /** Get dead letter jobs (for debugging) */
  getDeadLetters(): Job[] {
    return [...this.deadLetter];
  }

  /** Drain — stop accepting new jobs, finish processing */
  async drain(timeoutMs = 5000): Promise<void> {
    this.draining = true;
    const start = Date.now();
    while (this.processing > 0 && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/* ================================================================== */
/*  Singleton (survives HMR in dev)                                    */
/* ================================================================== */

const globalForQueue = globalThis as unknown as { jobQueue: JobQueue | undefined };
export const jobQueue = globalForQueue.jobQueue ?? new JobQueue(2);
if (process.env.NODE_ENV !== "production") {
  globalForQueue.jobQueue = jobQueue;
}
