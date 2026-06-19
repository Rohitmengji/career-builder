"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkipLink } from "@/lib/design-system-components";
import { useApplySubmit } from "@/lib/jobs/useApplySubmit";
import { APPLY_LIMITS, validateResumeFile, type ApplyField, type ApplyFormValues } from "@/lib/jobs/applyForm";
import {
  Container,
  Field,
  TextareaField,
  Button,
  ButtonLink,
  Alert,
  EmptyState,
  CheckIcon,
  ArrowLeftIcon,
} from "@/components/ui";

interface PageFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  coverLetter: string;
  resume: File | null;
}

const INITIAL: PageFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedin: "",
  portfolio: "",
  coverLetter: "",
  resume: null,
};

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ApplyPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const [form, setForm] = useState<PageFormState>(INITIAL);
  const [portfolioError, setPortfolioError] = useState("");

  const { status, formError, fieldErrors, applicationId, submit, isSubmitting, setFieldErrors, clearFieldError } =
    useApplySubmit({ allowResumeUrl: false });
  const submitted = status === "success";

  const onResumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      setForm((prev) => ({ ...prev, resume: file }));
      const err = file ? validateResumeFile(file) : null;
      if (err) setFieldErrors((prev) => ({ ...prev, resume: err }));
      else clearFieldError("resume");
    },
    [setFieldErrors, clearFieldError],
  );

  const formRef = useRef<HTMLFormElement>(null);
  const resumeInputId = useId();
  const fileStatusId = useId();
  const coverCountId = useId();

  // Warn before leaving while a submission is in flight (avoid losing it).
  useEffect(() => {
    if (!isSubmitting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSubmitting]);

  // Map page field names → the shared ApplyField so editing a field clears its
  // inline error (parity with the modal).
  const FIELD_MAP: Partial<Record<keyof PageFormState, ApplyField>> = {
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    phone: "phone",
    linkedin: "linkedinUrl",
    coverLetter: "coverLetter",
  };
  const set = useCallback(
    <K extends keyof PageFormState>(key: K, value: PageFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      const field = FIELD_MAP[key];
      if (field) clearFieldError(field);
    },
    // FIELD_MAP is a stable literal; clearFieldError is stable from the hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearFieldError],
  );

  const focusField = useCallback((field: ApplyField) => {
    const root = formRef.current;
    if (!root) return;
    // The file input is sr-only, but its drop-zone label has focus-within ring
    // styling, so focusing it surfaces a visible indicator. Scroll into view too.
    const selector = field === "resume" ? 'input[type="file"]' : `[name="${field}"]`;
    const el = root.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Portfolio is page-specific (folded into the cover letter); validate it
      // locally before delegating to the shared pipeline.
      if (form.portfolio.trim() && !isHttpUrl(form.portfolio.trim())) {
        setPortfolioError("Enter a valid URL (starting with https://).");
        focusField("coverLetter"); // nearest shared field; portfolio sits just above
        formRef.current?.querySelector<HTMLElement>('[name="portfolio"]')?.focus();
        return;
      }
      setPortfolioError("");

      const coverLetter = form.portfolio.trim()
        ? `${form.coverLetter ? form.coverLetter + "\n\n" : ""}Portfolio: ${form.portfolio.trim()}`
        : form.coverLetter;

      const values: ApplyFormValues = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        linkedinUrl: form.linkedin,
        coverLetter,
      };

      const outcome = await submit(jobId, values, form.resume);
      if (!outcome.ok && outcome.firstErrorField) focusField(outcome.firstErrorField);
    },
    [form, jobId, submit, focusField],
  );

  if (submitted) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-white px-4 sm:px-6">
        <EmptyState
          icon={<CheckIcon className="h-7 w-7 text-emerald-600" />}
          title="Application submitted!"
          body="Thank you for applying. Our team will review your application and get back to you within 5 business days."
          action={<ButtonLink href={`/${slug}`}>Browse more jobs</ButtonLink>}
          secondaryAction={<ButtonLink href={`/${slug}/jobs/${jobId}`} variant="secondary">Back to job</ButtonLink>}
        />
        {applicationId && <span className="sr-only">Reference {applicationId}</span>}
      </main>
    );
  }

  const coverLen = form.coverLetter.length;

  return (
    <>
      <SkipLink />
      <main id="main-content" className="min-h-screen bg-gray-50">
        <nav aria-label="Breadcrumb" className="border-b border-gray-200/80 bg-white">
          <Container className="max-w-2xl py-4">
            <Link
              href={`/${slug}/jobs/${jobId}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to job details
            </Link>
          </Container>
        </nav>

        <Container className="max-w-2xl py-12 md:py-16">
          <div className="mb-8">
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Apply for this position</h1>
            <p className="text-sm text-gray-600">Fill out the form below and we&apos;ll be in touch.</p>
          </div>

          {/* Alert already renders role="alert" + aria-live="assertive" for error tone. */}
          {formError && (
            <Alert tone="error" className="mb-6">{formError}</Alert>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
            <fieldset disabled={isSubmitting} className="m-0 space-y-6 border-0 p-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="First name"
                  name="firstName"
                  required
                  autoComplete="given-name"
                  value={form.firstName}
                  error={fieldErrors.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  placeholder="Jane"
                />
                <Field
                  label="Last name"
                  name="lastName"
                  required
                  autoComplete="family-name"
                  value={form.lastName}
                  error={fieldErrors.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  placeholder="Doe"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  error={fieldErrors.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="jane@example.com"
                />
                <Field
                  label="Phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  error={fieldErrors.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="LinkedIn profile"
                  name="linkedinUrl"
                  type="url"
                  inputMode="url"
                  value={form.linkedin}
                  error={fieldErrors.linkedinUrl}
                  onChange={(e) => set("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
                <Field
                  label="Portfolio / website"
                  name="portfolio"
                  type="url"
                  inputMode="url"
                  value={form.portfolio}
                  error={portfolioError}
                  onChange={(e) => {
                    set("portfolio", e.target.value);
                    if (portfolioError) setPortfolioError("");
                  }}
                  placeholder="https://..."
                />
              </div>

              {/* Resume */}
              <div>
                <label htmlFor={resumeInputId} className="mb-1.5 block text-sm font-medium text-gray-700">
                  Resume
                  <span className="text-red-600" aria-hidden="true"> *</span>
                  <span className="sr-only"> (required)</span>
                </label>
                <label
                  htmlFor={resumeInputId}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-6 text-center transition-colors hover:border-blue-500 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600"
                >
                  <input
                    id={resumeInputId}
                    type="file"
                    name="resume"
                    accept={APPLY_LIMITS.acceptAttr}
                    required
                    aria-required="true"
                    aria-invalid={fieldErrors.resume ? true : undefined}
                    aria-describedby={fieldErrors.resume ? `${resumeInputId}-err` : undefined}
                    onChange={onResumeChange}
                    className="sr-only"
                  />
                  <svg className="mb-2 h-8 w-8 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {form.resume ? (
                    <p className="text-sm font-medium text-gray-900">{form.resume.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX up to {APPLY_LIMITS.maxFileMb}MB</p>
                    </>
                  )}
                </label>
                <p id={fileStatusId} role="status" aria-live="polite" className="sr-only">
                  {form.resume ? `Selected file ${form.resume.name}` : "No file selected"}
                </p>
                {fieldErrors.resume && (
                  <p id={`${resumeInputId}-err`} role="alert" className="mt-1.5 text-xs text-red-700">
                    {fieldErrors.resume}
                  </p>
                )}
              </div>

              {/* Cover letter */}
              <div>
                <TextareaField
                  label="Cover letter"
                  name="coverLetter"
                  rows={5}
                  maxLength={APPLY_LIMITS.maxCoverLetterChars}
                  value={form.coverLetter}
                  error={fieldErrors.coverLetter}
                  onChange={(e) => set("coverLetter", e.target.value)}
                  placeholder="Tell us why you're excited about this role…"
                  aria-describedby={coverCountId}
                />
                <p id={coverCountId} className="mt-1 text-right text-xs text-gray-400" aria-live="polite">
                  {coverLen.toLocaleString()} / {APPLY_LIMITS.maxCoverLetterChars.toLocaleString()}
                </p>
              </div>
            </fieldset>

            <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
              <Button type="submit" size="lg" loading={isSubmitting} aria-busy={isSubmitting} fullWidth className="sm:w-auto">
                {isSubmitting ? "Submitting…" : "Submit application"}
              </Button>
              <Link
                href={`/${slug}/jobs/${jobId}`}
                // Block client-side navigation while a submission is in flight
                // (beforeunload only covers full unloads, not Next routing).
                onClick={(e) => {
                  if (isSubmitting) e.preventDefault();
                }}
                aria-disabled={isSubmitting || undefined}
                tabIndex={isSubmitting ? -1 : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isSubmitting ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Cancel
              </Link>
            </div>
          </form>
        </Container>
      </main>
    </>
  );
}
