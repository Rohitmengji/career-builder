import Link from "next/link";
import { sampleJobs } from "@/lib/jobs";
import { notFound } from "next/navigation";

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;
  const job = sampleJobs.find((j) => j.id === jobId);
  if (!job) notFound();

  return (
    <main className="min-h-screen bg-white">
      {/* Back nav */}
      <div className="border-b border-gray-100">
        <div className="max-w-300 mx-auto px-6 py-4">
          <Link
            href={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to All Jobs
          </Link>
        </div>
      </div>

      {/* Job header */}
      <section className="py-16 md:py-12 bg-linear-to-b from-gray-50 to-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {job.department}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {job.type}
            </span>
            <span className="text-xs text-gray-400">Posted {job.posted}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 mb-3">
            {job.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {job.location}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {job.salary}
            </span>
          </div>
          <div className="mt-8">
            <Link
              href={`/${slug}/jobs/${jobId}/apply`}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/15 transition-all duration-200"
            >
              Apply for This Role
            </Link>
          </div>
        </div>
      </section>

      {/* Job details */}
      <section className="py-16 md:py-12">
        <div className="max-w-3xl mx-auto px-6 space-y-12">
          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">About the Role</h2>
            <p className="text-gray-600 leading-relaxed">{job.description}</p>
          </div>

          {/* Requirements */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">What You&apos;ll Need</h2>
            <ul className="space-y-3">
              {job.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-600">
                  <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Nice to have */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Nice to Have</h2>
            <ul className="space-y-3">
              {job.niceToHave.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-600">
                  <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" /></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Benefits */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Benefits &amp; Perks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {job.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                  <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm text-gray-700">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Apply CTA at bottom */}
      <section className="py-16 md:py-12 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Interested in this role?</h2>
          <p className="text-gray-500 mb-6">We&apos;d love to hear from you. Apply now and our team will be in touch.</p>
          <Link
            href={`/${slug}/jobs/${jobId}/apply`}
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/15 transition-all duration-200"
          >
            Apply for This Role →
          </Link>
        </div>
      </section>
    </main>
  );
}
