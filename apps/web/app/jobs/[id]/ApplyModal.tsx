/*
 * ApplyModal — client component for the job application form (modal variant).
 *
 * Submission logic (validation, timeout/abort, idempotency, re-entry guard,
 * error mapping) lives in the shared pipeline (lib/jobs/useApplySubmit +
 * applyForm) so this modal and the full-page apply form behave identically.
 * This file owns only the modal presentation + accessibility.
 */

"use client";

import React, { useState, useCallback, useRef, useEffect, useId } from "react";
import { trackApplyStart, trackApplyComplete } from "@/lib/analytics";
import { useApplySubmit } from "@/lib/jobs/useApplySubmit";
import { APPLY_LIMITS, validateResumeFile, type ApplyFormValues, type ApplyField } from "@/lib/jobs/applyForm";
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
  screeningQuestions?: { q: string; requiredAnswer: "yes" | "no" }[];
}

const INITIAL_FORM: ApplyFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  resumeUrl: "",
  coverLetter: "",
};

export default function ApplyModal({ jobId, jobTitle, screeningQuestions = [] }: ApplyModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ApplyFormValues>(INITIAL_FORM);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const setScreeningAnswer = useCallback((index: number, value: "yes" | "no") => {
    setForm((prev) => ({
      ...prev,
      screeningAnswers: { ...(prev.screeningAnswers ?? {}), [String(index)]: value },
    }));
  }, []);

  const {
    status,
    formError,
    fieldErrors,
    submit,
    reset,
    clearFieldError,
    setFieldErrors,
    isSubmitting,
  } = useApplySubmit({ allowResumeUrl: true });

  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const successHeadingId = useId();
  const resumeErrId = useId();
  const fileStatusId = useId();
  const coverCountId = useId();

  // Open / close --------------------------------------------------------------
  const open = useCallback(() => {
    setIsOpen(true);
    setForm(INITIAL_FORM);
    setResumeFile(null);
    reset();
    trackApplyStart(jobId);
  }, [jobId, reset]);

  const close = useCallback(() => {
    setIsOpen(false);
    requestAnimationFrame(() =>
      triggerWrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
  }, []);

  // Sync <dialog> with state + move initial focus to the first field.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() =>
        dialog.querySelector<HTMLInputElement>("input, textarea")?.focus(),
      );
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Move focus to the success heading when the submission succeeds (so screen
  // readers and keyboard users land on the confirmation, not a removed button).
  useEffect(() => {
    if (status === "success") {
      requestAnimationFrame(() => successHeadingRef.current?.focus());
      trackApplyComplete(jobId);
    }
  }, [status, jobId]);

  const handleCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      close();
    },
    [close],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) close();
    },
    [close],
  );

  // Field changes — clear that field's error as the user corrects it.
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      clearFieldError(name as ApplyField);
    },
    [clearFieldError],
  );

  // Resume file selection — validate immediately (size/type) so the user gets
  // feedback now rather than at submit. Same rules the pipeline enforces.
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setResumeFile(file);
      const err = file ? validateResumeFile(file) : null;
      if (err) setFieldErrors((prev) => ({ ...prev, resume: err }));
      else clearFieldError("resume");
    },
    [clearFieldError, setFieldErrors],
  );

  const clearResume = useCallback(() => {
    setResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Move focus to the first invalid control. For the resume row, prefer the
  // always-visible URL input (the file input is sr-only — focusing it shows no
  // visible ring for sighted users). Scroll it into view within the dialog.
  const focusField = useCallback((field: ApplyField) => {
    const root = formRef.current;
    if (!root) return;
    const selector = field === "resume" ? 'input[name="resumeUrl"]' : `[name="${field}"]`;
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const outcome = await submit(jobId, form, resumeFile);
      if (!outcome.ok && outcome.firstErrorField) focusField(outcome.firstErrorField);
    },
    [submit, jobId, form, resumeFile, focusField],
  );

  const coverLen = form.coverLetter?.length ?? 0;

  return (
    <>
      <div ref={triggerWrapRef}>
        <Button onClick={open} fullWidth size="lg">
          Apply for this position
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        onCancel={handleCancel}
        aria-modal="true"
        aria-labelledby={status === "success" ? successHeadingId : headingId}
        className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex open:items-center open:justify-center"
      >
        <div className="mx-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          {status === "success" ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center" role="status" aria-live="polite">
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"
                aria-hidden="true"
              >
                <CheckIcon className="h-7 w-7" />
              </div>
              <h2
                id={successHeadingId}
                ref={successHeadingRef}
                tabIndex={-1}
                className="text-xl font-semibold text-gray-900 outline-none"
              >
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

              {/* Form-level error — assertive so screen readers announce it on submit failure */}
              {formError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Disable the entire form while submitting — blocks duplicate input/submit */}
                <fieldset disabled={isSubmitting} className="m-0 space-y-4 border-0 p-0">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="First name"
                      name="firstName"
                      autoComplete="given-name"
                      value={form.firstName}
                      onChange={onChange}
                      required
                      error={fieldErrors.firstName}
                      placeholder="Jane"
                    />
                    <Field
                      label="Last name"
                      name="lastName"
                      autoComplete="family-name"
                      value={form.lastName}
                      onChange={onChange}
                      required
                      error={fieldErrors.lastName}
                      placeholder="Doe"
                    />
                  </div>

                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={onChange}
                    required
                    error={fieldErrors.email}
                    placeholder="jane@example.com"
                  />

                  <Field
                    label="Phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone ?? ""}
                    onChange={onChange}
                    error={fieldErrors.phone}
                    placeholder="+1 (555) 000-0000"
                  />

                  <Field
                    label="LinkedIn URL"
                    name="linkedinUrl"
                    type="url"
                    inputMode="url"
                    value={form.linkedinUrl ?? ""}
                    onChange={onChange}
                    error={fieldErrors.linkedinUrl}
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
                      Upload a file or paste a link — at least one is required (max {APPLY_LIMITS.maxFileMb}MB)
                    </p>

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
                            <span className="font-medium text-blue-600">Upload file</span> — PDF, DOC, DOCX (max {APPLY_LIMITS.maxFileMb}MB)
                          </span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={APPLY_LIMITS.acceptAttr}
                            onChange={onFileChange}
                            aria-label="Upload resume file"
                            aria-invalid={fieldErrors.resume ? true : undefined}
                            aria-describedby={fieldErrors.resume ? resumeErrId : undefined}
                            className="sr-only"
                          />
                        </label>
                      )}
                    </div>

                    {/* Announce the selected file to screen readers */}
                    <p id={fileStatusId} role="status" aria-live="polite" className="sr-only">
                      {resumeFile ? `Selected file ${resumeFile.name}, ${formatFileSize(resumeFile.size)}` : "No file selected"}
                    </p>

                    <div className="my-2 flex items-center gap-3" aria-hidden="true">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs uppercase text-gray-500">or</span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>

                    <input
                      type="url"
                      name="resumeUrl"
                      inputMode="url"
                      value={form.resumeUrl ?? ""}
                      onChange={onChange}
                      placeholder="https://drive.google.com/... or link to your resume"
                      aria-label="Resume URL"
                      aria-invalid={fieldErrors.resume ? true : undefined}
                      aria-describedby={fieldErrors.resume ? resumeErrId : undefined}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                    />

                    {fieldErrors.resume && (
                      <p id={resumeErrId} role="alert" className="mt-1.5 text-xs text-red-700">
                        {fieldErrors.resume}
                      </p>
                    )}
                  </fieldset>

                  <div>
                    <TextareaField
                      label="Cover letter"
                      name="coverLetter"
                      value={form.coverLetter ?? ""}
                      onChange={onChange}
                      rows={4}
                      maxLength={APPLY_LIMITS.maxCoverLetterChars}
                      placeholder="Tell us why you'd be a great fit…"
                      hint="Optional"
                      error={fieldErrors.coverLetter}
                      aria-describedby={coverCountId}
                    />
                    <p id={coverCountId} className="mt-1 text-right text-xs text-gray-400" aria-live="polite">
                      {coverLen.toLocaleString()} / {APPLY_LIMITS.maxCoverLetterChars.toLocaleString()}
                    </p>
                  </div>

                  {screeningQuestions.length > 0 && (
                    <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
                      <legend className="px-1 text-sm font-medium text-gray-700">A few quick questions</legend>
                      {screeningQuestions.map((sq, i) => {
                        const selected = form.screeningAnswers?.[String(i)];
                        return (
                          <div key={i} role="radiogroup" aria-label={sq.q}>
                            <p className="mb-1.5 text-sm text-gray-800">{sq.q}</p>
                            <div className="flex gap-2">
                              {(["yes", "no"] as const).map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected === opt}
                                  onClick={() => setScreeningAnswer(i, opt)}
                                  className={`h-9 rounded-lg border px-4 text-sm font-medium capitalize transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                    selected === opt
                                      ? "border-blue-600 bg-blue-50 text-blue-700"
                                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </fieldset>
                  )}
                </fieldset>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" size="lg" fullWidth loading={isSubmitting} aria-busy={isSubmitting}>
                    {isSubmitting ? "Submitting…" : "Submit application"}
                  </Button>
                  <Button type="button" variant="ghost" size="lg" onClick={close} disabled={isSubmitting}>
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
