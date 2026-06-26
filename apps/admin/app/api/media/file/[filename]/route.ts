/*
 * API route: serve an uploaded media file by name (PUBLIC, no auth).
 *
 * WHAT: GET streams a file from the local media dir back with the right
 *   Content-Type. This is the public URL (PUBLIC_PATH in ../../route.ts) that
 *   image blocks in published pages point at.
 * WHY: the local storage driver keeps uploads on disk; the public web app and
 *   browsers need a way to fetch them, so this endpoint is intentionally
 *   unauthenticated. Tenant isolation does not apply here — filenames are
 *   crypto-random and globally unique, and there is no per-tenant directory.
 * HOW / SECURITY: untrusted filename, so defense-in-depth against path
 *   traversal — path.basename() + sanitizeFilename(), then isPathSafe() to
 *   confirm the resolved path stays inside MEDIA_DIR before any fs touch.
 *   SVGs are served as forced downloads with a locking-down CSP/sandbox so a
 *   malicious uploaded SVG can't run script even on direct navigation;
 *   X-Content-Type-Options: nosniff prevents MIME confusion. Note: this driver
 *   is dev/local only — see the cloud-storage note in ../../route.ts.
 */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { sanitizeFilename, isPathSafe } from "@career-builder/security/file-upload";

const MEDIA_DIR = path.join(process.cwd(), "data", "media");

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** GET /api/media/file/[filename] — serve uploaded media file (public) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename to prevent path traversal + null byte injection
  const safeName = sanitizeFilename(path.basename(filename));

  // Double-check resolved path is inside media dir
  if (!isPathSafe(safeName, MEDIA_DIR)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(MEDIA_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = safeName.split(".").pop()?.toLowerCase() || "";
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Prevent SVG from executing scripts in the browser: force download AND
      // sandbox via CSP so even a direct-navigation render can't run script.
      ...(ext === "svg"
        ? {
            "Content-Disposition": `attachment; filename="${safeName}"`,
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          }
        : {}),
    },
  });
}
