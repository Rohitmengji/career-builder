"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ApplyPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
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
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Application Submitted!</h1>
          <p className="text-gray-500 leading-relaxed mb-8">
            Thank you for applying. Our team will review your application and get back to you within 5 business days.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/${slug}`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
            >
              Browse More Jobs
            </Link>
            <Link
              href={`/${slug}/jobs/${jobId}`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
            >
              Back to Job
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Link
            href={`/${slug}/jobs/${jobId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Job Details
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Apply for this position</h1>
          <p className="text-sm text-gray-500">Fill out the form below and we&apos;ll be in touch.</p>
        </div>

        {status === "error" && errorMsg && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name *</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name *</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">LinkedIn Profile</label>
              <input
                type="url"
                value={form.linkedin}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Portfolio / Website</label>
              <input
                type="url"
                value={form.portfolio}
                onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Resume */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Resume *</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-white hover:border-gray-300 transition cursor-pointer">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                required
                onChange={(e) => setForm({ ...form, resume: e.target.files?.[0] || null })}
                className="hidden"
                id="resume-upload"
              />
              <label htmlFor="resume-upload" className="cursor-pointer">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {form.resume ? (
                  <p className="text-sm text-gray-700 font-medium">{form.resume.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOC up to 10MB</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Cover letter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cover Letter</label>
            <textarea
              rows={5}
              value={form.coverLetter}
              onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400 resize-none"
              placeholder="Tell us why you're excited about this role..."
            />
          </div>

          {/* Submit */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/15 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "submitting" ? "Submitting…" : "Submit Application"}
            </button>
            <Link
              href={`/${slug}/jobs/${jobId}`}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
