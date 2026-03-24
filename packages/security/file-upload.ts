/*
 * @career-builder/security — File Upload Security
 *
 * Protects against:
 *   - Malicious file uploads (executables disguised as documents)
 *   - MIME type spoofing
 *   - Path traversal attacks
 *   - Oversized uploads
 *   - Directory traversal in filenames
 *
 * Strategy:
 *   1. Check file extension against whitelist
 *   2. Validate MIME type
 *   3. Verify file magic bytes (header signature)
 *   4. Enforce size limits
 *   5. Generate unique, safe filenames
 *   6. Store outside public root
 */

import crypto from "crypto";
import path from "path";

/* ================================================================== */
/*  File type definitions                                              */
/* ================================================================== */

interface FileType {
  extensions: string[];
  mimeTypes: string[];
  /** Magic bytes signature (hex prefix of file content) */
  magicBytes?: string[];
}

const FILE_TYPES: Record<string, FileType> = {
  pdf: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    magicBytes: ["25504446"], // %PDF
  },
  docx: {
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    magicBytes: ["504b0304", "504b0506", "504b0708"], // PK (ZIP-based)
  },
  doc: {
    extensions: [".doc"],
    mimeTypes: ["application/msword"],
    magicBytes: ["d0cf11e0"], // OLE compound document
  },
  rtf: {
    extensions: [".rtf"],
    mimeTypes: ["application/rtf", "text/rtf"],
    magicBytes: ["7b5c7274"], // {\rt
  },
  txt: {
    extensions: [".txt"],
    mimeTypes: ["text/plain"],
    // No magic bytes for plain text
  },
  jpeg: {
    extensions: [".jpg", ".jpeg"],
    mimeTypes: ["image/jpeg"],
    magicBytes: ["ffd8ff"],
  },
  png: {
    extensions: [".png"],
    mimeTypes: ["image/png"],
    magicBytes: ["89504e47"],
  },
  gif: {
    extensions: [".gif"],
    mimeTypes: ["image/gif"],
    magicBytes: ["47494638"],
  },
  webp: {
    extensions: [".webp"],
    mimeTypes: ["image/webp"],
    magicBytes: ["52494646"], // RIFF
  },
  svg: {
    extensions: [".svg"],
    mimeTypes: ["image/svg+xml"],
    // SVG is text-based, check for opening tag instead
  },
};

/* ================================================================== */
/*  Preset configurations                                              */
/* ================================================================== */

export interface FileUploadConfig {
  /** Allowed file type names from FILE_TYPES */
  allowedTypes: string[];
  /** Maximum file size in bytes */
  maxSizeBytes: number;
  /** Storage directory (relative to process.cwd()) */
  storageDir: string;
  /** Whether to verify magic bytes */
  checkMagicBytes?: boolean;
}

export const UPLOAD_PRESETS = {
  /** Resume uploads: PDF, DOCX, DOC, RTF, TXT — max 5MB */
  resume: {
    allowedTypes: ["pdf", "docx", "doc", "rtf", "txt"],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    storageDir: "data/resumes",
    checkMagicBytes: true,
  } satisfies FileUploadConfig,

  /** Media uploads: images only — max 5MB */
  media: {
    allowedTypes: ["jpeg", "png", "gif", "webp", "svg"],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    storageDir: "data/media",
    checkMagicBytes: true,
  } satisfies FileUploadConfig,
};

/* ================================================================== */
/*  Validation                                                         */
/* ================================================================== */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  safeFilename?: string;
  detectedType?: string;
}

/**
 * Validate a file upload against security rules.
 * Returns validation result with a safe filename if valid.
 */
export function validateUpload(
  file: { name: string; size: number; type: string },
  buffer: Buffer | ArrayBuffer,
  config: FileUploadConfig,
): FileValidationResult {
  // 1. Check file size
  if (file.size > config.maxSizeBytes) {
    const maxMb = Math.round(config.maxSizeBytes / 1024 / 1024);
    return { valid: false, error: `File exceeds maximum size of ${maxMb}MB` };
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  // 2. Check extension
  const ext = path.extname(file.name).toLowerCase();
  let matchedType: string | null = null;

  for (const typeName of config.allowedTypes) {
    const typeInfo = FILE_TYPES[typeName];
    if (typeInfo && typeInfo.extensions.includes(ext)) {
      matchedType = typeName;
      break;
    }
  }

  if (!matchedType) {
    const allowedExts = config.allowedTypes
      .flatMap((t) => FILE_TYPES[t]?.extensions || [])
      .join(", ");
    return { valid: false, error: `File type not allowed. Accepted: ${allowedExts}` };
  }

  // 3. Check MIME type
  const typeInfo = FILE_TYPES[matchedType]!;
  if (!typeInfo.mimeTypes.includes(file.type)) {
    // Be lenient with MIME type — browsers sometimes report wrong types
    // But log a warning
    console.warn(
      `[FileUpload] MIME mismatch: expected ${typeInfo.mimeTypes.join("|")}, got ${file.type} for ${file.name}`,
    );
  }

  // 4. Check magic bytes (file header signature)
  if (config.checkMagicBytes && typeInfo.magicBytes) {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const header = buf.subarray(0, 8).toString("hex").toLowerCase();

    const matches = typeInfo.magicBytes.some((magic) => header.startsWith(magic.toLowerCase()));
    if (!matches) {
      return {
        valid: false,
        error: "File content does not match its extension. Possible spoofed file.",
      };
    }
  }

  // 5. SVG-specific check: scan for embedded scripts
  if (matchedType === "svg") {
    const content = Buffer.isBuffer(buffer)
      ? buffer.toString("utf-8")
      : Buffer.from(buffer).toString("utf-8");

    if (/<script/i.test(content) || /on\w+\s*=/i.test(content) || /javascript:/i.test(content)) {
      return { valid: false, error: "SVG files with embedded scripts are not allowed" };
    }
  }

  // 6. Generate safe filename
  const safeFilename = generateSafeFilename(file.name, ext);

  return { valid: true, safeFilename, detectedType: matchedType };
}

/**
 * Generate a unique, safe filename.
 * Format: {timestamp}-{random}-{sanitized-name}.{ext}
 */
export function generateSafeFilename(originalName: string, ext?: string): string {
  const extension = ext || path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, path.extname(originalName));
  const safeName = baseName
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 40);
  const random = crypto.randomBytes(6).toString("hex");
  const timestamp = Date.now();

  return `${timestamp}-${random}-${safeName}${extension}`;
}

/**
 * Sanitize a filename to prevent path traversal.
 * Strips directory components, null bytes, and special characters.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\0/g, "")              // Remove null bytes
    .replace(/\.\./g, "")            // Remove directory traversal
    .replace(/[/\\]/g, "")           // Remove path separators
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Only safe characters
    .substring(0, 200);              // Limit length
}

/**
 * Validate a file path to prevent directory traversal.
 * Returns true if the resolved path is within the allowed base directory.
 */
export function isPathSafe(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(baseDir, filePath);
  const resolvedBase = path.resolve(baseDir);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}
