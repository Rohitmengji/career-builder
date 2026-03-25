import React from "react";
import { LOGIN_URL } from "@/lib/marketing-config";

export default function FinalCta() {
  return (
    <section className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Gradient background card */}
        <div
          className="relative overflow-hidden rounded-3xl p-8 sm:p-12 lg:p-16"
          style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e1b4b 100%)",
          }}
        >
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-125 h-75 opacity-30 blur-3xl pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(59,130,246,0.4), transparent 70%)",
            }}
          />

          <div className="relative">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
              Start building your career site today
            </h2>
            <p className="text-base sm:text-lg text-blue-200 max-w-lg mx-auto mb-4">
              No engineering team needed. AI generates your career site in minutes.
              Free to start — no credit card required.
            </p>
            <p className="text-sm text-blue-300/70 mb-10">
              Join 500+ teams who launched their careers page this month
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
              <a
                href={LOGIN_URL}
                className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold px-8 py-4 min-h-12 rounded-xl text-sm sm:text-base hover:bg-gray-100 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <a
                href="#demo"
                className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-semibold px-8 py-4 min-h-12 rounded-xl text-sm sm:text-base hover:bg-white/10 transition-all"
              >
                See Preview
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
