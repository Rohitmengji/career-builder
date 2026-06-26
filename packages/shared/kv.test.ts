/*
 * Unit tests for resolveKvDriver in ./kv — picks the key-value backend
 * (in-memory vs Upstash Redis) from environment.
 *
 * WHY: the KV store backs things like rate limits and idempotency keys. On
 * serverless (Vercel) the in-memory driver is per-instance, so silently using it
 * in production would mean those guarantees don't actually hold cluster-wide —
 * hence the warning path is asserted, not just the driver choice.
 *
 * Behaviors asserted (driver resolution precedence):
 *  - an explicit KV_DRIVER env var wins over auto-detection (even when Upstash
 *    is configured but KV_DRIVER says "memory");
 *  - otherwise auto-select `redis` when UPSTASH_REDIS_REST_URL is present;
 *  - default to `memory` with no config;
 *  - emit a one-time warning (matching /per-instance/i) ONLY when falling back to
 *    memory on serverless prod (VERCEL=1 + NODE_ENV=production), and stay silent
 *    in local dev. The warn fn is injected so the test can assert on it.
 */
import { describe, it, expect, vi } from "vitest";
import { resolveKvDriver } from "./kv";

describe("resolveKvDriver", () => {
  it("honors an explicit KV_DRIVER override", () => {
    expect(resolveKvDriver({ KV_DRIVER: "redis" } as NodeJS.ProcessEnv, () => {})).toBe("redis");
    expect(resolveKvDriver({ KV_DRIVER: "memory", UPSTASH_REDIS_REST_URL: "x" } as NodeJS.ProcessEnv, () => {})).toBe("memory");
  });

  it("auto-selects redis when Upstash is configured", () => {
    expect(resolveKvDriver({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io" } as NodeJS.ProcessEnv, () => {})).toBe("redis");
  });

  it("defaults to memory with no config", () => {
    expect(resolveKvDriver({} as NodeJS.ProcessEnv, () => {})).toBe("memory");
  });

  it("warns when falling back to memory on serverless prod", () => {
    const warn = vi.fn();
    const driver = resolveKvDriver({ VERCEL: "1", NODE_ENV: "production" } as NodeJS.ProcessEnv, warn);
    expect(driver).toBe("memory");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatch(/per-instance/i);
  });

  it("does not warn in local dev memory mode", () => {
    const warn = vi.fn();
    resolveKvDriver({ NODE_ENV: "development" } as NodeJS.ProcessEnv, warn);
    expect(warn).not.toHaveBeenCalled();
  });
});
