/*
 * Resume text extraction (SERVER-ONLY) — turns an uploaded resume into plain
 * text for recruiters, search, and the match engine.
 *
 * Parsing untrusted files is a real risk (malformed input → CPU/memory DoS), so
 * every call is tightly guarded and FAIL-SAFE — it returns null rather than
 * throwing, and the apply flow treats null as "no parsed text" (never blocks an
 * application on parsing). Guards:
 *   - allow-list of MIME types (PDF, plain text) — nothing else is parsed;
 *   - hard byte cap (defence-in-depth; the upload route already caps at 5MB);
 *   - a wall-clock timeout (a pathological file can't hang the request);
 *   - an output cap (bounded text reaches the DB / AI);
 *   - pure-JS parser (unpdf/pdf.js) — no native code, no shell-out, no network.
 */

import { extractText, getDocumentProxy } from "unpdf";

export const MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_TEXT_CHARS = 50_000;
export const EXTRACT_TIMEOUT_MS = 8_000;
/**
 * Max concurrent extractions PER SERVER INSTANCE. The timeout is advisory — pdf.js
 * keeps running after we stop awaiting it — so a flood of parse-heavy PDFs could
 * pile up CPU/memory. This cap bounds that: once saturated we skip extraction
 * (resumeText stays null; the application is unaffected). Pure cancellation would
 * need worker-thread isolation — a deliberate future hardening, noted in the PR.
 */
export const MAX_CONCURRENT_EXTRACTIONS = 3;
let activeExtractions = 0;

const PDF_TYPES = new Set(["application/pdf"]);
const TEXT_TYPES = new Set(["text/plain"]);

export interface ExtractInput {
  bytes: ArrayBuffer | Uint8Array;
  mimeType: string;
}

/** Collapse runaway whitespace and cap length so bounded text flows downstream. */
function normalize(text: string): string {
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > MAX_TEXT_CHARS ? cleaned.slice(0, MAX_TEXT_CHARS) : cleaned;
}

/** Reject if a single op runs too long — a malformed file must not hang a request. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      console.warn("[resume-extract] timed out (parse continues in background)");
      reject(new Error("resume extraction timed out"));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Extract plain text from a resume. Returns null on anything unexpected
 * (unsupported type, oversize, timeout, parse error, empty result) — never throws.
 */
export async function extractResumeText(
  input: ExtractInput,
  opts: { timeoutMs?: number } = {},
): Promise<string | null> {
  try {
    const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    const mime = (input.mimeType || "").toLowerCase().split(";")[0].trim();
    const timeoutMs = opts.timeoutMs ?? EXTRACT_TIMEOUT_MS;

    if (TEXT_TYPES.has(mime)) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const out = normalize(text);
      return out.length > 0 ? out : null;
    }

    if (PDF_TYPES.has(mime)) {
      // Bound concurrent parse load per instance (the timeout can't cancel pdf.js).
      if (activeExtractions >= MAX_CONCURRENT_EXTRACTIONS) {
        console.warn("[resume-extract] skipped: extractor saturated");
        return null;
      }
      activeExtractions++;
      try {
        const text = await withTimeout(
          (async () => {
            const pdf = await getDocumentProxy(bytes);
            const { text } = await extractText(pdf, { mergePages: true });
            return Array.isArray(text) ? text.join("\n") : text;
          })(),
          timeoutMs,
        );
        const out = normalize(text || "");
        return out.length > 0 ? out : null;
      } finally {
        activeExtractions--;
      }
    }

    return null; // unsupported type → not parsed
  } catch {
    return null; // fail-safe: parsing never blocks the apply flow
  }
}
