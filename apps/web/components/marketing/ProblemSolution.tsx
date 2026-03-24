import React from "react";

const PROBLEMS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: "Career sites take weeks to build",
    subtext: "Engineering becomes the bottleneck for every hiring push",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    text: "Dependence on developers slows hiring",
    subtext: "Every change requires a sprint ticket and a 2-week wait",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    text: "Outdated UX hurts candidate conversion",
    subtext: "Top candidates bounce when your careers page looks like 2015",
  },
];

const SOLUTIONS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    text: "Generate a complete career site instantly with AI",
    subtext: "Enter your company name → get a multi-page site in seconds",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    ),
    text: "Built-in job system — no integrations needed",
    subtext: "Create, manage, and track applications from one dashboard",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    text: "Edit visually — no coding required",
    subtext: "Drag, drop, customize. Your HR team can own the entire page",
  },
];

export default function ProblemSolution() {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            Why HireBase
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            Hiring shouldn&apos;t be blocked by engineering
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Problems */}
          <div>
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              The problem
            </div>
            <div className="space-y-4">
              {PROBLEMS.map((p, i) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-red-50/60 border border-red-100/60 hover:bg-red-50 hover:border-red-200/80 transition-all duration-200">
                  <div className="shrink-0 w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    {p.icon}
                  </div>
                  <div>
                    <p className="text-base text-gray-800 font-semibold">{p.text}</p>
                    <p className="text-sm text-gray-500 mt-1">{p.subtext}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Solutions */}
          <div>
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              The solution
            </div>
            <div className="space-y-4">
              {SOLUTIONS.map((s, i) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-green-50/60 border border-green-100/60 hover:bg-green-50 hover:border-green-200/80 transition-all duration-200">
                  <div className="shrink-0 w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-base text-gray-800 font-semibold">{s.text}</p>
                    <p className="text-sm text-gray-500 mt-1">{s.subtext}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
