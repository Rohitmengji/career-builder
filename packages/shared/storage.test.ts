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
