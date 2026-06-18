/*
 * ApplyModal — Client component for job application form.
 *
 * Renders a button that opens a modal with a multi-field form.
 * Submits to POST /api/jobs/apply and shows success/error feedback.
 */

"use client";

import React, { useState, useCallback, useRef, useEffect, useId } from "react";
import { trackApplyStart, trackApplyComplete } from "@/lib/analytics";
import {
  Button,
  Field,
  TextareaField,
  CheckIcon,
  XIcon,
} from "@/components/ui";

interface ApplyModalProps {
  jobId: string;
  jobTitle: string;
}

interface FormFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  resumeUrl: string;
  coverLetter: string;
}

const INITIAL_FORM: FormFields = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  resumeUrl: "",
  coverLetter: "",
};

const ACCEPTED_RESUME_TYPES = ".pdf,.doc,.docx,.rtf,.txt";
const MAX_FILE_SIZE_MB = 10;

type Status = "idle" | "submitting" | "success" | "error";

export default function ApplyModal({ jobId, jobTitle }: ApplyModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormFields>(INITIAL_FORM);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const resumeErrId = useId();

  // Open / close
  const open = useCallback(() => {
    setIsOpen(true);
    setStatus("idle");
    setForm(INITIAL_FORM);
    setResumeFile(null);
    setResumeError("");
    setErrorMsg("");
    trackApplyStart(jobId);
  }, [jobId]);

  const close = useCallback(() => {
    setIsOpen(false);
    // Restore focus to the trigger that opened the dialog
    requestAnimationFrame(() =>
      triggerWrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
  }, []);

  // Sync <dialog> with state + move initial focus to first field
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      // Focus the first focusable field once the dialog is rendered
      requestAnimationFrame(() =>
        dialog.querySelector<HTMLInputElement>("input, textarea")?.focus(),
      );
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Native <dialog> dispatches a "cancel" event on Escape — keep state in sync
  // (this also avoids a duplicate keydown listener).
  const handleCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      close();
    },
    [close],
  );

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) close();
    },
    [close],
  );

  // Field change handler
  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Resume file handler
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setResumeError("");
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setResumeFile(null);
      return;
    }
    // Validate size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setResumeError(`File must be under ${MAX_FILE_SIZE_MB}MB`);
      setResumeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setResumeFile(file);
  }, []);

  const clearResume = useCallback(() => {
    setResumeFile(null);
    setResumeError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      // Require at least one of file or URL
      if (!resumeFile && !form.resumeUrl.trim()) {
        setResumeError("Please upload a resume file or provide a resume URL");
        return;
      }
      setStatus("submitting");
      setErrorMsg("");

      try {
        // Build multipart form data for file upload
        const payload = new globalThis.FormData();
        payload.append("jobId", jobId);
        payload.append("firstName", form.firstName);
        payload.append("lastName", form.lastName);
        payload.append("email", form.email);
        if (form.phone) payload.append("phone", form.phone);
        if (form.linkedinUrl) payload.append("linkedinUrl", form.linkedinUrl);
        if (form.coverLetter) payload.append("coverLetter", form.coverLetter);
        if (form.resumeUrl.trim()) payload.append("resumeUrl", form.resumeUrl.trim());
        if (resumeFile) payload.append("resume", resumeFile);

        const res = await fetch("/api/jobs/apply", {
          method: "POST",
          body: payload,
        });

        const data = await res.json();

        if (data.success) {
          setStatus("success");
          trackApplyComplete(jobId);
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Application failed. Please try again.");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Network error. Please check your connection and try again.");
      }
    },
    [jobId, form, resumeFile],
  );

  return (
    <>
      {/* Trigger button */}
      <div ref={triggerWrapRef}>
        <Button onClick={open} fullWidth size="lg">
          Apply for this position
        </Button>
      </div>

      {/* Modal */}
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        onCancel={handleCancel}
        aria-labelledby={headingId}
        className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex open:items-center open:justify-center"
      >
        <div className="mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          {status === "success" ? (
            /* ──── Success state ──── */
            <div className="py-8 text-center" role="status" aria-live="polite">
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"
                aria-hidden="true"
              >
                <CheckIcon className="h-7 w-7" />
              </div>
              <h2 id={headingId} className="text-xl font-semibold text-gray-900">
                Application submitted
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Thank you for applying to <strong className="font-semibold text-gray-900">{jobTitle}</strong>.
                We&apos;ll review your application and get back to you within 5 business days.
              </p>
              <div className="mt-6">
                <Button variant="secondary" onClick={close}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            /* ──── Form ──── */
            <>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 id={headingId} className="text-xl font-semibold text-gray-900">
                    Apply now
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-600">{jobTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  aria-label="Close dialog"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="First name"
                    name="firstName"
                    value={form.firstName}
                    onChange={onChange}
                    required
                    placeholder="Jane"
                  />
                  <Field
                    label="Last name"
                    name="lastName"
                    value={form.lastName}
                    onChange={onChange}
                    required
                    placeholder="Doe"
                  />
                </div>

                <Field
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  required
                  placeholder="jane@example.com"
                />

                <Field
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={onChange}
                  placeholder="+1 (555) 000-0000"
                />

                <Field
                  label="LinkedIn URL"
                  name="linkedinUrl"
                  type="url"
                  value={form.linkedinUrl}
                  onChange={onChange}
                  placeholder="https://linkedin.com/in/janedoe"
                />

                {/* Resume — file upload OR URL */}
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-1.5 block text-sm font-medium text-gray-700">
                    Resume
                    <span className="text-red-600" aria-hidden="true"> *</span>
                    <span className="sr-only"> (required)</span>
                  </legend>
                  <p className="mb-2 text-xs text-gray-500">
                    Upload a file or paste a link — at least one is required
                  </p>

                  {/* File upload */}
                  <div className="mb-2">
                    {resumeFile ? (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm">
                        <FileIcon />
                        <span className="flex-1 truncate font-medium text-blue-800">{resumeFile.name}</span>
                        <span className="shrink-0 text-xs text-blue-700">{formatFileSize(resumeFile.size)}</span>
                        <button
                          type="button"
                          onClick={clearResume}
                          aria-label={`Remove ${resumeFile.name}`}
                          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 transition-colors hover:border-blue-400 hover:bg-blue-50/50 focus-within:ring-2 focus-within:ring-blue-600">
                        <UploadIcon />
                        <span className="text-sm text-gray-600">
                          <span className="font-medium text-blue-600">Upload file</span> — PDF, DOC, DOCX (max {MAX_FILE_SIZE_MB}MB)
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_RESUME_TYPES}
                          onChange={onFileChange}
                          aria-label="Upload resume file"
                          aria-invalid={resumeError ? true : undefined}
                          aria-describedby={resumeError ? resumeErrId : undefined}
                          className="sr-only"
                        />
                      </label>
                    )}
                  </div>

                  {/* OR divider */}
                  <div className="my-2 flex items-center gap-3" aria-hidden="true">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs uppercase text-gray-500">or</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {/* Resume URL */}
                  <input
                    type="url"
                    name="resumeUrl"
                    value={form.resumeUrl}
                    onChange={onChange}
                    placeholder="https://drive.google.com/... or link to your resume"
                    aria-label="Resume URL"
                    aria-invalid={resumeError ? true : undefined}
                    aria-describedby={resumeError ? resumeErrId : undefined}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                  />

                  {resumeError && (
                    <p id={resumeErrId} role="alert" className="mt-1.5 text-xs text-red-700">
                      {resumeError}
                    </p>
                  )}
                </fieldset>

                <TextareaField
                  label="Cover letter"
                  name="coverLetter"
                  value={form.coverLetter}
                  onChange={onChange}
                  rows={4}
                  placeholder="Tell us why you'd be a great fit…"
                  hint="Optional"
                />

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={status === "submitting"}
                  >
                    {status === "submitting" ? "Submitting…" : "Submit application"}
                  </Button>
                  <Button type="button" variant="ghost" size="lg" onClick={close}>
                    Cancel
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ================================================================== */
/*  Icons (decorative — aria-hidden)                                   */
/* ================================================================== */

function UploadIcon() {
  return (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
