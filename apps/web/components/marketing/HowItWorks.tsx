/*
 * HowItWorks — the "Live in 4 steps" section of the marketing page.
 *
 * WHAT: renders the static STEPS array as an ordered list of numbered cards
 * (template -> AI generate -> customize -> publish). Pure presentational server
 * component; no state or data fetching.
 *
 * HOW / note: on large screens a decorative connector line is drawn between
 * adjacent steps — it's suppressed after the last step (i < STEPS.length - 1)
 * and is aria-hidden since it carries no meaning.
 */
import React from "react";
import { Container, Section, SectionHeader } from "@/components/ui";

const STEPS = [
  {
    number: "01",
    title: "Choose a template",
    description: "Pick from professionally designed career site templates, or start blank.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "AI generates your site",
    description: "Enter your company name and industry. AI builds homepage, about, culture, and job pages.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Customize visually",
    description: "Drag blocks, edit copy, change colors — all with our visual editor. No code needed.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Publish instantly",
    description: "One click to publish. Your career site is live with jobs, applications, and analytics.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <Section id="how-it-works" muted>
      <Container>
        <SectionHeader
          eyebrow="Simple setup"
          title="Live in 4 steps"
          subtitle="No meetings. No onboarding. No developer handoffs."
        />

        {/* Steps */}
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.number} className="relative group">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[calc(50%+2.5rem)] -right-6 h-px bg-linear-to-r from-blue-200 to-gray-200" aria-hidden="true" />
              )}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-100/60 rounded-2xl shadow-sm mb-5 text-blue-600 group-hover:shadow-md group-hover:scale-105 transition-all duration-300" aria-hidden="true">
                  {step.icon}
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold mb-3" aria-hidden="true">{i + 1}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
