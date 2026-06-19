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
