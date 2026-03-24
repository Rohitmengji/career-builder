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
      // Prevent SVG from executing scripts in browser
      ...(ext === "svg" ? { "Content-Disposition": "attachment" } : {}),
    },
  });
}
