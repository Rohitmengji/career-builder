/*
 * /about/ai-usage — AI transparency disclosure (ADR-0014, EU AI-Act §13).
 * Static content describing where AI is used, what data it sees, the human
 * oversight in place, and the candidate's right to object.
 */

import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "How we use AI",
  description: "Transparency about where and how this hiring platform uses AI.",
};

const USES = [
  { title: "Job-match explanation", body: "When you view a role, we can show why your background may or may not match it — grounded only in the role's stated requirements. It's informational and never makes an automated decision about your application." },
  { title: "Résumé structuring", body: "We may extract a structured summary (skills, titles, education) from your résumé to help recruiters scan it. The model is instructed to use only what's in your résumé and not to invent anything." },
  { title: "Inclusive job descriptions", body: "We help employers flag potentially exclusionary wording in their job postings before publishing. This runs on the job description, not on candidates." },
  { title: "Fairer interview evaluations", body: "We help interviewers spot biased wording or unsupported judgments in their own written scorecards, so evaluations stay evidence-based and fair. This runs on the interviewer's notes — never on your personal data — and is advisory only." },
];

export default function AiUsagePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">How we use AI</h1>
        <p className="mt-2 text-sm text-gray-600">
          We use AI to make hiring more transparent and fair — never to make an automated decision about you.
          Here is exactly where it is used and how your data is handled.
        </p>

        <section className="mt-8 space-y-5">
          {USES.map((u) => (
            <div key={u.title} className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900">{u.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{u.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-3 text-sm text-gray-600">
          <h2 className="text-lg font-semibold text-gray-900">Your data &amp; your rights</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Contact details are removed</strong> before any text is sent to the AI provider — the model does not receive your name, email, or phone for matching/structuring.</li>
            <li><strong>No automated decisions.</strong> A human always makes hiring decisions; AI output is advisory and is logged for oversight.</li>
            <li><strong>No sensitive attributes.</strong> The AI is instructed to ignore name, gender, age, and ethnicity, and any voluntary diversity data you provide is never sent to it.</li>
            <li><strong>You can object.</strong> You may request that AI assistance not be used in reviewing your application, and you can export or delete your data at any time from your profile.</li>
          </ul>
          <p className="pt-2">
            The platform uses a third-party large-language-model provider via API. Questions or requests?
            Contact the employer&apos;s hiring team or your data-protection contact.
          </p>
        </section>
      </main>
    </div>
  );
}
