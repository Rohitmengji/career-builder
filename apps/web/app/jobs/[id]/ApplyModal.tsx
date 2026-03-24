/*
 * ApplyModal — Client component for job application form.
 *
 * Renders a button that opens a modal with a multi-field form.
 * Submits to POST /api/jobs/apply and shows success/error feedback.
 */

"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

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

  // Open / close
  const open = useCallback(() => {
    setIsOpen(true);
    setStatus("idle");
    setForm(INITIAL_FORM);
    setResumeFile(null);
    setResumeError("");
    setErrorMsg("");
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Sync <dialog> with state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) close();
    },
    [close],
  );

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

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
      <button
        onClick={open}
        className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Apply for this position
      </button>

      {/* Modal */}
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 p-0 m-0 w-full h-full max-w-none max-h-none bg-transparent backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex open:items-center open:justify-center"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          {status === "success" ? (
            /* ──── Success state ──── */
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
              <p className="text-gray-600 mb-6">
                Thank you for applying to <strong>{jobTitle}</strong>. We&apos;ll review your application
                and get back to you within 5 business days.
              </p>
              <button
                onClick={close}
                className="bg-gray-100 text-gray-700 font-medium py-2 px-6 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            /* ──── Form ──── */
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Apply Now</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{jobTitle}</p>
                </div>
                <button
                  onClick={close}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resume <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Upload a file or paste a link — at least one is required</p>

                  {/* File upload */}
                  <div className="mb-2">
                    {resumeFile ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                        <FileIcon />
                        <span className="truncate flex-1 text-blue-800 font-medium">{resumeFile.name}</span>
                        <span className="text-blue-500 text-xs shrink-0">{formatFileSize(resumeFile.size)}</span>
                        <button type="button" onClick={clearResume} className="text-blue-400 hover:text-blue-600 ml-1 shrink-0">&times;</button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                        <UploadIcon />
                        <span className="text-sm text-gray-500">
                          <span className="font-medium text-blue-600">Upload file</span> — PDF, DOC, DOCX (max {MAX_FILE_SIZE_MB}MB)
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_RESUME_TYPES}
                          onChange={onFileChange}
                          className="sr-only"
                        />
                      </label>
                    )}
                  </div>

                  {/* OR divider */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 uppercase">or</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Resume URL */}
                  <input
                    type="url"
                    name="resumeUrl"
                    value={form.resumeUrl}
                    onChange={onChange}
                    placeholder="https://drive.google.com/... or link to your resume"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />

                  {resumeError && (
                    <p className="text-xs text-red-600 mt-1">{resumeError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cover letter <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    name="coverLetter"
                    value={form.coverLetter}
                    onChange={onChange}
                    rows={4}
                    placeholder="Tell us why you'd be a great fit…"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="flex-1 bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {status === "submitting" ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner />
                        Submitting…
                      </span>
                    ) : (
                      "Submit Application"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="py-3 px-4 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
                  >
                    Cancel
                  </button>
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
/*  Field component                                                    */
/* ================================================================== */

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
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
/*  Icons                                                              */
/* ================================================================== */

function UploadIcon() {
  return (
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

/* ================================================================== */
/*  Spinner                                                            */
/* ================================================================== */

function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}
