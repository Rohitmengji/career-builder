"use client";

import React, { useEffect, useRef, useState } from "react";
import { LOGIN_URL } from "@/lib/marketing-config";

/* ── Animated product preview tabs ────────────────────────────────── */
const PREVIEW_TABS = ["Career Site", "Editor", "Jobs"] as const;

export default function Hero() {
  const glowRef = useRef<HTMLDivElement>(null);
  const [previewTab, setPreviewTab] = useState(0);

  // Mouse-following glow (throttled via rAF)
  useEffect(() => {
    let raf = 0;
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!glowRef.current) return;
        const rect = glowRef.current.getBoundingClientRect();
        glowRef.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        glowRef.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
      });
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => { window.removeEventListener("mousemove", handleMouseMove); cancelAnimationFrame(raf); };
  }, []);

  // Auto-cycle preview tabs
  useEffect(() => {
    const timer = setInterval(() => setPreviewTab((p) => (p + 1) % 3), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      ref={glowRef}
      className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32 lg:pt-44 lg:pb-36"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.12), transparent 70%), radial-gradient(ellipse 60% 40% at 80% 50%, rgba(99,102,241,0.06), transparent), linear-gradient(to bottom, #f8faff, #ffffff)",
      }}
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        aria-hidden="true"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Mouse glow */}
      <div
        className="absolute w-150 h-150 rounded-full opacity-20 pointer-events-none blur-3xl"
        aria-hidden="true"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)",
          left: "var(--mouse-x, 50%)",
          top: "var(--mouse-y, 50%)",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
          {/* ── Left — Copy ──────────────────────────────────────── */}
          <div className="flex-1 max-w-2xl text-center lg:text-left">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 bg-blue-50/80 text-blue-700 px-4 py-2 rounded-full text-xs font-semibold mb-8 border border-blue-100/80 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>
              AI-Powered Hiring Platform
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.05]">
              Build your career{" "}
              <br className="hidden sm:block" />
              site in{" "}
              <span className="bg-clip-text text-transparent bg-linear-to-r from-blue-600 via-indigo-500 to-violet-600 gradient-text-animate">
                minutes.
              </span>
              <br />
              <span className="text-gray-300 font-bold">Not weeks.</span>
            </h1>

            {/* Sub-headline */}
            <p className="mt-6 text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
              AI-powered career pages, job listings, and hiring workflows — all
              in one platform. No developers needed.
            </p>

            {/* Social proof line */}
            <p className="mt-3 text-sm font-medium text-gray-400">
              Used by teams to launch hiring pages <span className="text-blue-600 font-bold">10× faster</span>
            </p>

            {/* CTA — email capture */}
            <div className="mt-10 flex flex-col gap-4 items-center lg:items-start">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
                  window.location.href = `${LOGIN_URL}?email=${encodeURIComponent(email)}`;
                }}
                className="flex flex-col sm:flex-row w-full max-w-md gap-3"
              >
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Enter your work email"
                  aria-label="Work email address"
                  className="flex-1 min-w-0 px-5 py-4 rounded-xl border border-gray-200 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 h-14 rounded-xl text-base transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
                >
                  Start Free
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </form>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium text-sm transition-colors group"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                or see a demo first
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                No code required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>
                Launch in minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                Used by hiring teams
              </span>
            </div>
          </div>

          {/* ── Right — Animated product preview ─────────────────── */}
          <div className="flex-1 max-w-xl w-full">
            <div className="relative">
              {/* Browser chrome */}
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xl shadow-gray-900/8 overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white rounded-lg border border-gray-200 px-4 py-1 text-xs text-gray-400 font-mono">
                      {previewTab === 1 ? "app.hirebase.dev/editor" : previewTab === 2 ? "acme.hirebase.dev/jobs" : "acme.hirebase.dev"}
                    </div>
                  </div>
                </div>

                {/* Tab switcher inside preview */}
                <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-gray-100 bg-gray-50/50">
                  {PREVIEW_TABS.map((tab, i) => (
                    <button
                      key={tab}
                      onClick={() => setPreviewTab(i)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        previewTab === i
                          ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Preview content */}
                <div className="p-6 min-h-72 relative">
                  <div key={previewTab} className="animate-in">
                    {previewTab === 0 && <PreviewCareerSite />}
                    {previewTab === 1 && <PreviewEditor />}
                    {previewTab === 2 && <PreviewJobs />}
                  </div>
                </div>
              </div>

              {/* Floating badge — AI Generated */}
              <div className="absolute -bottom-5 -right-3 sm:-right-5 bg-white rounded-xl border border-gray-200/80 shadow-lg shadow-gray-900/6 px-4 py-3 flex items-center gap-3 float">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">AI Generated</p>
                  <p className="text-xs text-gray-500">In 30 seconds</p>
                </div>
              </div>

              {/* Floating badge — top-left stat */}
              <div className="absolute -top-3 -left-3 sm:-left-5 bg-white rounded-xl border border-gray-200/80 shadow-lg shadow-gray-900/6 px-4 py-2.5 float" style={{ animationDelay: "1.5s" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-xs font-semibold text-gray-900">12 roles published</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Mini preview components ─────────────────────────────────────── */

function PreviewCareerSite() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg shimmer" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-2.5 w-10 bg-gray-100 rounded" />
          <div className="h-2.5 w-10 bg-gray-100 rounded" />
          <div className="h-7 w-18 bg-blue-600 rounded-md" />
        </div>
      </div>
      <div className="text-center py-6 space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          <div className="h-2 w-16 bg-blue-200 rounded" />
        </div>
        <div className="h-7 w-64 bg-gray-800 rounded-lg mx-auto" />
        <div className="h-3 w-48 bg-gray-200 rounded mx-auto" />
        <div className="flex gap-2 justify-center pt-1">
          <div className="h-9 w-28 bg-blue-600 rounded-lg" />
          <div className="h-9 w-28 bg-gray-100 rounded-lg border border-gray-200" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center space-y-1 py-2">
            <div className="h-5 w-8 bg-blue-100 rounded mx-auto" />
            <div className="h-2 w-14 bg-gray-100 rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewEditor() {
  return (
    <div className="flex gap-3">
      <div className="w-40 space-y-2 shrink-0">
        <div className="h-2.5 w-12 bg-gray-300 rounded mb-3" />
        {["Hero", "Stats", "Team", "Jobs", "CTA"].map((name) => (
          <div key={name} className="flex items-center gap-2 p-2 rounded-md bg-gray-50 border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer">
            <div className="w-5 h-5 bg-blue-100 rounded" />
            <span className="text-[11px] text-gray-600 font-medium">{name}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 border border-dashed border-blue-300 rounded-lg bg-blue-50/30 p-3 space-y-2.5">
        <div className="p-3 rounded-md bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="h-4 w-40 bg-gray-800 rounded" />
          <div className="h-2.5 w-56 bg-gray-200 rounded" />
          <div className="h-7 w-20 bg-blue-600 rounded-md mt-1.5" />
        </div>
        <div className="p-3 rounded-md bg-white border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-14 bg-gray-300 rounded" />
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-blue-100 rounded" />
              <div className="w-4 h-4 bg-red-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewJobs() {
  const jobs = [
    { title: "Senior Frontend Engineer", tag: "Eng" },
    { title: "Product Designer", tag: "Design" },
    { title: "Growth Manager", tag: "Marketing" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 h-9 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3 gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <div className="h-2 w-28 bg-gray-200 rounded" />
        </div>
        <div className="h-9 w-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
          <div className="h-2 w-14 bg-gray-300 rounded" />
        </div>
      </div>
      <div className="h-2 w-28 bg-gray-200 rounded" />
      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.title} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-blue-200 transition-all cursor-pointer group">
            <div className="w-8 h-8 bg-blue-50 rounded-lg shrink-0 flex items-center justify-center">
              <div className="w-4 h-4 bg-blue-200 rounded" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-3 w-40 bg-gray-200 rounded mb-1" />
              <div className="h-2 w-24 bg-gray-100 rounded" />
            </div>
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{job.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
