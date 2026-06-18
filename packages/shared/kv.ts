/*
 * Durable key-value store abstraction.
 *
 * WHY: rate limiters, login lockouts, webhook idempotency, SSE listener
 * registries and short-lived caches were all kept in per-process memory. On a
 * serverless / multi-instance deployment (Vercel) that state is per-instance
 * and lost on every cold start, so:
 *   - rate limits & login lockouts are trivially bypassed by hitting a
 *     different instance,
 *   - Stripe webhook idempotency breaks (an event can be processed twice),
 *   - caches thrash.
 *
 * This module provides a small async KV interface with TTL support, so those
 * consumers can share durable state in production while keeping a zero-config
 * in-memory implementation for local dev / single-instance.
 *
 * Driver selection (env KV_DRIVER):
 *   - "memory" (default) → in-process Map. EPHEMERAL & per-instance.
 *   - "redis"            → Upstash Redis REST (UPSTASH_REDIS_REST_URL +
 *                          UPSTASH_REDIS_REST_TOKEN), lazy-imported. Works on
 *                          edge/serverless. Also covers self-hosted via the
 *                          REST proxy.
 */

export interface KVStore {
  driver: "memory" | "redis";
  get(key: string): Promise<string | null>;
  /** Set a value with an optional TTL (seconds). */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomic increment; sets TTL on first increment when provided. Returns new value. */
  incr(key: string, ttlSeconds?: number): Promise<number>;
}

/* ── In-memory driver ──────────────────────────────────────────────── */

interface Entry {
  value: string;
  expiresAt: number | null;
}

function createMemoryStore(): KVStore {
  const map = new Map<string, Entry>();

  // Opportunistic cleanup so the map can't grow unbounded. Unref so it never
  // keeps the process alive.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, e] of map) {
      if (e.expiresAt !== null && e.expiresAt <= now) map.delete(k);
    }
  }, 60_000);
  if (typeof timer.unref === "function") timer.unref();

  function live(key: string): Entry | null {
    const e = map.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      map.delete(key);
      return null;
    }
    return e;
  }

  return {
    driver: "memory",
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, ttlSeconds) {
      map.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    },
    async del(key) {
      map.delete(key);
    },
    async incr(key, ttlSeconds) {
      const e = live(key);
      const next = (e ? parseInt(e.value, 10) || 0 : 0) + 1;
      map.set(key, {
        value: String(next),
        expiresAt: e?.expiresAt ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : null),
      });
      return next;
    },
  };
}

/* ── Upstash Redis (REST) driver ───────────────────────────────────── */

function createRedisStore(): KVStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "[kv] KV_DRIVER=redis requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
    );
  }

  // Lazy import keeps @upstash/redis optional (only needed when this driver is
  // selected). The magic comments stop bundlers from eagerly resolving it.
  async function client() {
    // Optional dependency — only present when KV_DRIVER=redis. Resolved at
    // runtime; not type-checked or bundled.
    // @ts-ignore optional peer dependency, may not be installed
    const { Redis } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@upstash/redis");
    return new Redis({ url, token });
  }

  return {
    driver: "redis",
    async get(key) {
      const r = await client();
      const v = await r.get(key);
      return v == null ? null : String(v);
    },
    async set(key, value, ttlSeconds) {
      const r = await client();
      if (ttlSeconds) await r.set(key, value, { ex: ttlSeconds });
      else await r.set(key, value);
    },
    async del(key) {
      const r = await client();
      await r.del(key);
    },
    async incr(key, ttlSeconds) {
      const r = await client();
      const next = await r.incr(key);
      if (next === 1 && ttlSeconds) await r.expire(key, ttlSeconds);
      return next;
    },
  };
}

let _kv: KVStore | null = null;

/** Get the process-wide KV store (singleton). */
export function getKV(): KVStore {
  if (_kv) return _kv;
  const driver = (process.env.KV_DRIVER || "memory").toLowerCase();
  _kv = driver === "redis" ? createRedisStore() : createMemoryStore();
  return _kv;
}
