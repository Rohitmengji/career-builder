/*
 * Publish Queue — Safe deployment batching for page publishes.
 *
 * Problem: Immediate publish on every editor save causes:
 *   - ISR revalidation storms
 *   - Unnecessary Vercel rebuilds
 *   - Potential data inconsistency
 *
 * Solution: Batch page updates with a debounce window.
 *   - Changes are queued in memory (and optionally persisted)
 *   - Publishing happens only when explicitly triggered or after debounce
 *   - Track last publish timestamp for audit trail
 *
 * Usage:
 *   import { publishQueue } from "@/lib/deployment/publishQueue";
 *
 *   // Queue a page change (called on editor save)
 *   publishQueue.enqueue({ tenantId, slug, blocks });
 *
 *   // Manual publish (called from "Publish" button)
 *   await publishQueue.publishNow();
 *
 *   // Get queue status
 *   publishQueue.getStatus();
 */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface PublishItem {
  tenantId: string;
  slug: string;
  blocks: unknown[];
  queuedAt: number;
}

export interface PublishStatus {
  pendingCount: number;
  lastPublishedAt: number | null;
  isPublishing: boolean;
  items: Array<{ tenantId: string; slug: string; queuedAt: number }>;
}

type PublishHandler = (items: PublishItem[]) => Promise<void>;

/* ================================================================== */
/*  Publish Queue Implementation                                       */
/* ================================================================== */

const DEFAULT_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

class PublishQueue {
  private queue = new Map<string, PublishItem>(); // key = tenantId:slug
  private lastPublishedAt: number | null = null;
  private isPublishing = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private handler: PublishHandler | null = null;

  constructor(debounceMs = DEFAULT_DEBOUNCE_MS) {
    this.debounceMs = debounceMs;
  }

  /**
   * Register the publish handler — called with batched items when publishing.
   */
  onPublish(handler: PublishHandler): void {
    this.handler = handler;
  }

  /**
   * Queue a page change. Deduplicates by tenantId:slug (latest wins).
   */
  enqueue(item: PublishItem): void {
    const key = `${item.tenantId}:${item.slug}`;
    this.queue.set(key, { ...item, queuedAt: Date.now() });

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.publishNow().catch(console.error);
    }, this.debounceMs);
  }

  /**
   * Publish all queued items immediately (manual trigger).
   */
  async publishNow(): Promise<{ published: number; errors: string[] }> {
    if (this.isPublishing) {
      return { published: 0, errors: ["Publish already in progress"] };
    }

    if (this.queue.size === 0) {
      return { published: 0, errors: [] };
    }

    if (!this.handler) {
      return { published: 0, errors: ["No publish handler registered"] };
    }

    this.isPublishing = true;
    const items = Array.from(this.queue.values());
    const errors: string[] = [];

    try {
      await this.handler(items);
      this.queue.clear();
      this.lastPublishedAt = Date.now();

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown publish error");
    } finally {
      this.isPublishing = false;
    }

    return { published: errors.length === 0 ? items.length : 0, errors };
  }

  /**
   * Get current queue status.
   */
  getStatus(): PublishStatus {
    return {
      pendingCount: this.queue.size,
      lastPublishedAt: this.lastPublishedAt,
      isPublishing: this.isPublishing,
      items: Array.from(this.queue.values()).map(({ tenantId, slug, queuedAt }) => ({
        tenantId,
        slug,
        queuedAt,
      })),
    };
  }

  /**
   * Clear the queue without publishing.
   */
  clear(): void {
    this.queue.clear();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

/* ================================================================== */
/*  Singleton export                                                   */
/* ================================================================== */

// Global singleton — survives hot reload in dev
const globalForQueue = globalThis as unknown as {
  publishQueue: PublishQueue | undefined;
};

export const publishQueue =
  globalForQueue.publishQueue ?? new PublishQueue();

if (process.env.NODE_ENV !== "production") {
  globalForQueue.publishQueue = publishQueue;
}
