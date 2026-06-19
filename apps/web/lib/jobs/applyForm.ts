/*
 * Shared job-application submission pipeline.
 *
 * One source of truth for BOTH apply UIs (the modal on /jobs/[id] and the
 * full-page form on /[slug]/jobs/[jobId]/apply): client validation, payload
 * building, resilient submission (timeout + abort + non-JSON guard +
 * idempotency), and user-friendly HTTP-status → message mapping.
 *
 * Pure + framework-agnostic (no React) so it is unit-testable in node. The
 * React state machine that consumes it lives in useApplySubmit.ts.
 */

/* ================================================================== */
/*  Limits & constants (mirror the SERVER resume preset)               */
/* ================================================================== */

// Kept in sync with UPLOAD_PRESETS.resume in @career-builder/security/file-upload
// (5MB, pdf/doc/docx/rtf/txt). Centralized so the two UIs can't drift and the
// client surfaces the same limit the server enforces.
export const APPLY_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxFileMb: 5,
  acceptedExtensions: [".pdf", ".doc", ".docx", ".rtf", ".txt"] as const,
  acceptAttr: ".pdf,.doc,.docx,.rtf,.txt",
  maxCoverLetterChars: 10_000,
  requestTimeoutMs: 30_000,
  /** LinkedIn hosts the server accepts (parity with the apply route). */
  linkedinHosts: ["linkedin.com", "www.linkedin.com"] as const,
} as const;

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface ApplyFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  /** A URL to a hosted resume — an alternative to uploading a file. */
  resumeUrl?: string;
  coverLetter?: string;
}

export type ApplyField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "linkedinUrl"
  | "resume"
  | "coverLetter";

export type ApplyFieldErrors = Partial<Record<ApplyField, string>>;

export interface ValidationResult {
  valid: boolean;
  errors: ApplyFieldErrors;
  /** First field (in form order) with an error — used to move focus. */
  firstErrorField?: ApplyField;
}

export type SubmitResult =
  | { ok: true; applicationId: string; duplicate?: boolean }
  | { ok: false; message: string; status?: number };

/* ================================================================== */
/*  User-facing messages (actionable, never leak internals)            */
/* ================================================================== */

export const APPLY_MESSAGES = {
  timeout: "This is taking longer than expected. Please check your connection and try again.",
  network: "We couldn't reach the server. Please check your connection and try again.",
  offline: "You appear to be offline. Reconnect and try again.",
  unexpected: "Unable to submit your application right now. Please try again in a few minutes.",
} as const;

/** Map an HTTP response to a friendly, actionable message (no internal leakage). */
export function messageForResponse(status: number, serverMessage?: string): string {
  switch (status) {
    case 400:
      // Our 400s come from schema validation and are safe + specific.
      return serverMessage?.trim() || "Please review the form and try again.";
    case 401:
      return "Your session expired. Please refresh the page and try again.";
    case 403:
      return "This application can't be submitted from here. Please reload the page and try again.";
    case 404:
      return "This position is no longer accepting applications.";
    case 409:
      return "You've already applied to this position.";
    case 413:
      return `Your resume is too large. Please upload a file under ${APPLY_LIMITS.maxFileMb}MB.`;
    case 429:
      return "Too many attempts. Please wait a moment and try again.";
    default:
      if (status >= 500) return APPLY_MESSAGES.unexpected;
      return serverMessage?.trim() || APPLY_MESSAGES.unexpected;
  }
}

/* ================================================================== */
/*  Validation (client-side; server re-validates everything)           */
/* ================================================================== */

// Pragmatic email shape check — the server is the source of truth, this is
// only for fast inline feedback.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(value: string): URL | null {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/** Validate a selected resume file (size + extension). Returns an error or null. */
export function validateResumeFile(file: File): string | null {
  if (file.size === 0) return "This file appears to be empty. Please choose another.";
  if (file.size > APPLY_LIMITS.maxFileBytes) {
    return `File must be under ${APPLY_LIMITS.maxFileMb}MB.`;
  }
  const ext = fileExtension(file.name);
  if (!APPLY_LIMITS.acceptedExtensions.includes(ext as (typeof APPLY_LIMITS.acceptedExtensions)[number])) {
    return `Unsupported file type. Use ${APPLY_LIMITS.acceptedExtensions.join(", ")}.`;
  }
  return null;
}

interface ValidateOptions {
  /** When true, a file OR a resumeUrl satisfies the resume requirement. */
  allowResumeUrl?: boolean;
}

/**
 * Validate the apply form. `resumeFile` is passed separately (it isn't part of
 * the serializable values). With allowResumeUrl, either a file or a URL counts.
 */
export function validateApplyForm(
  values: ApplyFormValues,
  resumeFile: File | null,
  options: ValidateOptions = {},
): ValidationResult {
  const errors: ApplyFieldErrors = {};

  if (!values.firstName?.trim()) errors.firstName = "First name is required.";
  else if (values.firstName.trim().length > 100) errors.firstName = "First name is too long.";

  if (!values.lastName?.trim()) errors.lastName = "Last name is required.";
  else if (values.lastName.trim().length > 100) errors.lastName = "Last name is too long.";

  const email = values.email?.trim() ?? "";
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email) || email.length > 254) errors.email = "Enter a valid email address.";

  if (values.phone && values.phone.trim().length > 30) errors.phone = "Phone number is too long.";

  const linkedin = values.linkedinUrl?.trim();
  if (linkedin) {
    const u = isHttpUrl(linkedin);
    if (!u) errors.linkedinUrl = "Enter a valid URL (starting with https://).";
    else if (!APPLY_LIMITS.linkedinHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
      errors.linkedinUrl = "Enter a LinkedIn profile URL (linkedin.com).";
    }
  }

  // Resume: a file is required unless a URL is allowed and provided.
  const resumeUrl = values.resumeUrl?.trim();
  if (resumeFile) {
    const fileErr = validateResumeFile(resumeFile);
    if (fileErr) errors.resume = fileErr;
  } else if (options.allowResumeUrl && resumeUrl) {
    if (!isHttpUrl(resumeUrl)) errors.resume = "Enter a valid resume URL (starting with https://).";
  } else {
    errors.resume = options.allowResumeUrl
      ? "Upload a resume file or paste a link to one."
      : "Please attach your resume.";
  }

  if (values.coverLetter && values.coverLetter.length > APPLY_LIMITS.maxCoverLetterChars) {
    errors.coverLetter = `Cover letter must be under ${APPLY_LIMITS.maxCoverLetterChars.toLocaleString()} characters.`;
  }

  // First error in visual form order — for focus management.
  const order: ApplyField[] = ["firstName", "lastName", "email", "phone", "linkedinUrl", "resume", "coverLetter"];
  const firstErrorField = order.find((f) => errors[f]);

  return { valid: Object.keys(errors).length === 0, errors, firstErrorField };
}

/* ================================================================== */
/*  Payload + submission                                               */
/* ================================================================== */

/** Build the multipart payload the apply API expects. */
export function buildApplyPayload(
  values: ApplyFormValues,
  resumeFile: File | null,
  jobId: string,
): FormData {
  const payload = new FormData();
  payload.append("jobId", jobId);
  payload.append("firstName", values.firstName.trim());
  payload.append("lastName", values.lastName.trim());
  payload.append("email", values.email.trim());
  if (values.phone?.trim()) payload.append("phone", values.phone.trim());
  if (values.linkedinUrl?.trim()) payload.append("linkedinUrl", values.linkedinUrl.trim());
  if (values.coverLetter?.trim()) payload.append("coverLetter", values.coverLetter.trim());
  if (values.resumeUrl?.trim()) payload.append("resumeUrl", values.resumeUrl.trim());
  if (resumeFile) payload.append("resume", resumeFile);
  return payload;
}

export interface SubmitOptions {
  /** External signal (e.g. abort on unmount). */
  signal?: AbortSignal;
  /** Idempotency key — dedupes retries/refreshes of the same attempt server-side. */
  idempotencyKey?: string;
  timeoutMs?: number;
}

/**
 * Submit an application. Resilient: enforces a timeout (AbortController),
 * tolerates an external abort signal, guards against non-JSON responses, and
 * maps every status to a friendly message. Never throws.
 */
export async function submitApplication(
  values: ApplyFormValues,
  resumeFile: File | null,
  jobId: string,
  options: SubmitOptions = {},
): Promise<SubmitResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? APPLY_LIMITS.requestTimeoutMs;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Mirror an external abort (unmount) onto our controller.
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  try {
    const res = await fetch("/api/jobs/apply", {
      method: "POST",
      body: buildApplyPayload(values, resumeFile, jobId),
      headers: options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : undefined,
      signal: controller.signal,
    });

    // Guard against non-JSON (proxy HTML error pages, empty bodies, etc.).
    let data: { success?: boolean; applicationId?: string; error?: string; duplicate?: boolean } | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.ok && data?.success) {
      return { ok: true, applicationId: data.applicationId ?? "", duplicate: data.duplicate };
    }
    return { ok: false, status: res.status, message: messageForResponse(res.status, data?.error) };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // An external abort (unmount) is intentional — surface a neutral message
      // the caller can choose to ignore; a timeout abort is a real failure.
      return { ok: false, message: timedOut ? APPLY_MESSAGES.timeout : APPLY_MESSAGES.network };
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { ok: false, message: APPLY_MESSAGES.offline };
    }
    return { ok: false, message: APPLY_MESSAGES.network };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
