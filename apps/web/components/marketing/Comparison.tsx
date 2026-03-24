import React from "react";

const CHECK = (
  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const CROSS = (
  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FEATURES = [
  { name: "AI site generation", us: true, workable: false, lever: false },
  { name: "Built-in job system", us: true, workable: true, lever: true },
  { name: "Visual drag & drop editor", us: true, workable: false, lever: false },
  { name: "AI content assistant", us: true, workable: false, lever: false },
  { name: "Multi-tenant branding", us: true, workable: false, lever: false },
  { name: "Geo-based pricing", us: true, workable: false, lever: false },
  { name: "Time to launch", us: "Minutes", workable: "Days", lever: "Weeks" },
  { name: "Setup time", us: "Minutes", workable: "Days", lever: "Days" },
  { name: "Starting price", us: "Free", workable: "$299/mo", lever: "Custom" },
];

export default function Comparison() {
  return (
    <section id="comparison" className="py-24 sm:py-32 bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            How we compare
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            Built different
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            See how HireBase stacks up against traditional ATS platforms.
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
          <table className="w-full" aria-label="Feature comparison between HireBase, Workable, and Lever">
            {/* Header row */}
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-sm font-semibold text-gray-500 px-6 py-4">Feature</th>
                <th className="text-center text-sm font-bold text-blue-600 px-4 py-4 bg-blue-50/50">HireBase</th>
                <th className="text-center text-sm font-semibold text-gray-400 px-4 py-4">Workable</th>
                <th className="text-center text-sm font-semibold text-gray-400 px-4 py-4">Lever</th>
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {FEATURES.map((f, i) => (
                <tr
                  key={f.name}
                  className={`hover:bg-gray-50/50 transition-colors ${i < FEATURES.length - 1 ? "border-b border-gray-100" : ""}`}
                >
                  <td className="text-sm text-gray-700 font-medium px-6 py-4">{f.name}</td>
                  <td className="text-center px-4 py-4 bg-blue-50/30">
                    {typeof f.us === "boolean" ? (
                      <span className="inline-flex justify-center">{f.us ? CHECK : CROSS}</span>
                    ) : (
                      <span className="text-sm font-bold text-blue-600">{f.us}</span>
                    )}
                  </td>
                  <td className="text-center px-4 py-4">
                    {typeof f.workable === "boolean" ? (
                      <span className="inline-flex justify-center">{f.workable ? CHECK : CROSS}</span>
                    ) : (
                      <span className="text-sm text-gray-500">{f.workable}</span>
                    )}
                  </td>
                  <td className="text-center px-4 py-4">
                    {typeof f.lever === "boolean" ? (
                      <span className="inline-flex justify-center">{f.lever ? CHECK : CROSS}</span>
                    ) : (
                      <span className="text-sm text-gray-500">{f.lever}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
