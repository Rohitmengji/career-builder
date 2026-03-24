import React from "react";

const LOGOS = [
  "Acme Corp",
  "TechFlow",
  "Quantum",
  "NovaBuild",
  "CloudStack",
  "DataPulse",
];

export default function SocialProof() {
  return (
    <section className="py-16 border-t border-gray-100 bg-gray-50/30">
      <div className="max-w-7xl mx-auto px-6">
        {/* Top — trust line + rating */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Trusted by modern hiring teams
          </p>
          <div className="flex items-center gap-1.5">
            <div className="flex" aria-label="4.9 out of 5 stars">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className={`w-4 h-4 ${i <= 4 ? "text-amber-400" : "text-amber-300"}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-semibold text-gray-600">4.9/5</span>
            <span className="text-xs text-gray-400">from early users</span>
          </div>
        </div>

        {/* Logos — grayscale, hover reveals */}
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6">
          {LOGOS.map((name) => (
            <div
              key={name}
              className="text-xl font-bold text-gray-300 tracking-tight select-none opacity-60 hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-300 cursor-default"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
