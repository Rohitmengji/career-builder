"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SkipLink } from "@/lib/design-system-components";
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

export default function ApplyPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const resumeInputId = useId();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    linkedin: "",
    portfolio: "",
    coverLetter: "",
    resume: null as File | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resume) {
      setStatus("error");
      setErrorMsg("Please attach your resume.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");

    try {
      // Build multipart payload matching POST /api/jobs/apply.
      const payload = new globalThis.FormData();
      payload.append("jobId", jobId);
      payload.append("firstName", form.firstName);
      payload.append("lastName", form.lastName);
      payload.append("email", form.email);
      if (form.phone) payload.append("phone", form.phone);
      if (form.linkedin) payload.append("linkedinUrl", form.linkedin);
      // The apply API has no portfolio field — fold it into the cover letter
      // so the candidate's link is preserved rather than silently dropped.
      let cover = form.coverLetter;
      if (form.portfolio) cover = `${cover ? cover + "\n\n" : ""}Portfolio: ${form.portfolio}`;
      if (cover) payload.append("coverLetter", cover);
      payload.append("resume", form.resume);

      const res = await fetch("/api/jobs/apply", { method: "POST", body: payload });
      const data = await res.json().catch(() => ({ success: false, error: "Unexpected server response." }));

      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Application failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  };

  if (submitted) {
    return (
      <main id="main-content" className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6">
        <EmptyState
          icon={<CheckIcon className="h-7 w-7 text-emerald-600" />}
          title="Application submitted!"
          body="Thank you for applying. Our team will review your application and get back to you within 5 business days."
          action={<ButtonLink href={`/${slug}`}>Browse more jobs</ButtonLink>}
          secondaryAction={<ButtonLink href={`/${slug}/jobs/${jobId}`} variant="secondary">Back to job</ButtonLink>}
        />
      </main>
    );
  }

  const submitting = status === "submitting";

  return (
    <>
      <SkipLink />
      <main id="main-content" className="min-h-screen bg-gray-50">
        {/* Header */}
        <nav aria-label="Breadcrumb" className="bg-white border-b border-gray-200/80">
          <Container className="max-w-2xl py-4">
            <Link
              href={`/${slug}/jobs/${jobId}`}
              className="inline-flex items-center gap-1.5 min-h-11 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to job details
            </Link>
          </Container>
        </nav>

        {/* Form */}
        <Container className="max-w-2xl py-12 md:py-16">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Apply for this position</h1>
            <p className="text-sm text-gray-600">Fill out the form below and we&apos;ll be in touch.</p>
          </div>

          {status === "error" && errorMsg && (
            <Alert tone="error" className="mb-6">{errorMsg}</Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="First name"
                required
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jane"
              />
              <Field
                label="Last name"
                required
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
              />
              <Field
                label="Phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="LinkedIn profile"
                type="url"
                value={form.linkedin}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
              <Field
                label="Portfolio / website"
                type="url"
                value={form.portfolio}
                onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
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
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-6 text-center cursor-pointer transition-colors hover:border-blue-500 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600"
              >
                <input
                  id={resumeInputId}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  required
                  aria-required="true"
                  onChange={(e) => setForm({ ...form, resume: e.target.files?.[0] || null })}
                  className="sr-only"
                />
                <svg className="h-8 w-8 text-gray-500 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {form.resume ? (
                  <p className="text-sm font-medium text-gray-900">{form.resume.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOC up to 10MB</p>
                  </>
                )}
              </label>
            </div>

            {/* Cover letter */}
            <TextareaField
              label="Cover letter"
              rows={5}
              value={form.coverLetter}
              onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
              placeholder="Tell us why you're excited about this role…"
            />

            {/* Submit */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Button type="submit" size="lg" loading={submitting} fullWidth className="sm:w-auto">
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
              <Link
                href={`/${slug}/jobs/${jobId}`}
                className="inline-flex items-center min-h-11 px-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
