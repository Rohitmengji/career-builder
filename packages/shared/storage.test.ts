/*
 * Unit tests for ./storage — the file-storage abstraction (local-disk driver +
 * cloud object-key namespacing).
 *
 * WHY: uploads (resumes, logos, media) must land in the right place in dev and,
 * critically, must NOT collide or leak across tenants in cloud object storage.
 * The tenant prefix in the object key is the isolation boundary here (tenant
 * isolation is enforced in app code, not by the store — see CLAUDE.md), so it
 * gets its own test.
 *
 * Behaviors asserted:
 *  - createStorage defaults to the `local` driver when STORAGE_DRIVER is unset;
 *  - the local driver writes the bytes to disk and returns a public URL + key,
 *    and delete is idempotent (no throw when the file is already gone);
 *  - objectKeyFor namespaces every key under `t/<tenantId>/…` so two tenants'
 *    "cv.pdf" can't collide, omits the tenant segment for back-compat when no
 *    tenantId is given, and normalizes stray slashes in the prefix.
 *
 * Uses a per-PID tmp dir cleaned up in afterAll so concurrent test runs don't clash.
 */
import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createStorage, objectKeyFor } from "./storage";

const dir = path.join(os.tmpdir(), `cb-storage-test-${process.pid}`);

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

describe("storage (local driver)", () => {
  it("defaults to the local driver when STORAGE_DRIVER is unset", () => {
    const s = createStorage({ localDir: dir, localPublicPrefix: "/media", keyPrefix: "media" });
    expect(s.driver).toBe("local");
  });

  it("writes the file and returns a public url + key", async () => {
    const s = createStorage({ localDir: dir, localPublicPrefix: "/media", keyPrefix: "media" });
    const res = await s.put("logo.png", Buffer.from("PNGDATA"), "image/png");
    expect(res.url).toBe("/media/logo.png");
    expect(res.key).toBe("logo.png");
    const written = await fs.readFile(path.join(dir, "logo.png"), "utf8");
    expect(written).toBe("PNGDATA");
  });

  it("delete removes the file (idempotent)", async () => {
    const s = createStorage({ localDir: dir, localPublicPrefix: "/media" });
    await s.put("tmp.txt", Buffer.from("x"), "text/plain");
    await s.delete("tmp.txt");
    await expect(fs.readFile(path.join(dir, "tmp.txt"))).rejects.toBeTruthy();
    await expect(s.delete("tmp.txt")).resolves.toBeUndefined(); // no throw on missing
  });
});

describe("objectKeyFor (cloud key namespacing)", () => {
  it("namespaces by tenant so keys can't collide/leak across tenants", () => {
    expect(objectKeyFor({ tenantId: "acme", keyPrefix: "resumes" }, "cv.pdf")).toBe("t/acme/resumes/cv.pdf");
    expect(objectKeyFor({ tenantId: "globex", keyPrefix: "resumes" }, "cv.pdf")).toBe("t/globex/resumes/cv.pdf");
  });

  it("omits the tenant segment when no tenantId is given (back-compat)", () => {
    expect(objectKeyFor({ keyPrefix: "media" }, "logo.png")).toBe("media/logo.png");
    expect(objectKeyFor({}, "logo.png")).toBe("logo.png");
  });

  it("normalizes stray slashes in the prefix", () => {
    expect(objectKeyFor({ tenantId: "acme", keyPrefix: "/media/" }, "a.png")).toBe("t/acme/media/a.png");
  });
});
