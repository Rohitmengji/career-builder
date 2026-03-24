"use client";

import React, { useState } from "react";
import { LOGIN_URL } from "@/lib/marketing-config";

const TABS = [
  {
    id: "career-site",
    label: "Career Site",
    description: "AI-generated career pages with modern design — ready in seconds.",
  },
  {
    id: "editor",
    label: "Visual Editor",
    description: "Drag & drop 30+ blocks. Customize every pixel without writing code.",
  },
  {
    id: "jobs",
    label: "Job Listings",
    description: "Full job management with search, filters, and application tracking.",
  },
];

export default function DemoPreview() {
  const [active, setActive] = useState("career-site");
  const activeTab = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <section id="demo" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            See it in action
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            From idea to live site in minutes
          </h2>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1" role="tablist" aria-label="Product demo tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActive(tab.id)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active === tab.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-gray-500 mb-8 text-base">{activeTab.description}</p>

        {/* Device mock */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/40 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex gap-1.5" aria-hidden="true">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white rounded-md border border-gray-200 px-4 py-1 text-xs text-gray-400 font-mono">
                  {active === "editor" ? "app.hirebase.dev/editor" : active === "jobs" ? "careers.acme.com/jobs" : "careers.acme.com"}
                </div>
              </div>
            </div>

            {/* Tab content */}
            <div className="p-8 min-h-105" role="tabpanel" id={`panel-${active}`} aria-label={activeTab.label}>
              {active === "career-site" && <CareerSiteMock />}
              {active === "editor" && <EditorMock />}
              {active === "jobs" && <JobsMock />}
            </div>
          </div>
        </div>

        {/* CTA under demo */}
        <div className="text-center mt-10">
          <a
            href={LOGIN_URL}
            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gray-900/10"
          >
            Try this yourself
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <p className="mt-3 text-sm text-gray-400">Free to start · No credit card required</p>
        </div>
      </div>
    </section>
  );
}

/* ── Career site mock ────────────────────────────────────────────── */
function CareerSiteMock() {
  return (
    <div className="space-y-6 animate-in">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
        <div className="flex gap-4">
          <div className="h-2.5 w-12 bg-gray-100 rounded" />
          <div className="h-2.5 w-12 bg-gray-100 rounded" />
          <div className="h-8 w-24 bg-blue-600 rounded-lg" />
        </div>
      </div>
      {/* Hero */}
      <div className="text-center py-10 space-y-4">
        <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          <div className="h-2 w-20 bg-blue-200 rounded" />
        </div>
        <div className="h-8 w-80 bg-gray-800 rounded-lg mx-auto" />
        <div className="h-3 w-64 bg-gray-200 rounded mx-auto" />
        <div className="flex gap-3 justify-center pt-2">
          <div className="h-10 w-32 bg-blue-600 rounded-lg" />
          <div className="h-10 w-32 bg-gray-100 rounded-lg border border-gray-200" />
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center space-y-1">
            <div className="h-6 w-12 bg-blue-100 rounded mx-auto" />
            <div className="h-2 w-16 bg-gray-100 rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Editor mock ─────────────────────────────────────────────────── */
function EditorMock() {
  return (
    <div className="flex gap-4 animate-in">
      {/* Sidebar */}
      <div className="w-56 space-y-3 shrink-0">
        <div className="h-3 w-16 bg-gray-300 rounded mb-4" />
        {["Hero Block", "Stats Bar", "Team Grid", "Job List", "CTA Section", "Testimonials"].map((name) => (
          <div key={name} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
            <div className="w-6 h-6 bg-blue-100 rounded" />
            <span className="text-xs text-gray-600 font-medium">{name}</span>
          </div>
        ))}
      </div>
      {/* Canvas */}
      <div className="flex-1 border border-dashed border-blue-300 rounded-xl bg-blue-50/30 p-4 space-y-3">
        <div className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="h-5 w-48 bg-gray-800 rounded" />
          <div className="h-2.5 w-64 bg-gray-200 rounded" />
          <div className="h-8 w-24 bg-blue-600 rounded-lg mt-2" />
        </div>
        <div className="p-4 rounded-lg bg-white border-2 border-blue-500 shadow-sm ring-2 ring-blue-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-16 bg-gray-300 rounded" />
            <div className="flex gap-1">
              <div className="w-5 h-5 bg-blue-100 rounded" />
              <div className="w-5 h-5 bg-blue-100 rounded" />
              <div className="w-5 h-5 bg-red-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="h-4 w-32 bg-gray-800 rounded" />
          <div className="space-y-1.5">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-50 rounded-lg border border-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Job listings mock ───────────────────────────────────────────── */
function JobsMock() {
  const jobs = [
    { title: "Senior Frontend Engineer", dept: "Engineering", loc: "San Francisco, CA", type: "Full-time" },
    { title: "Product Designer", dept: "Design", loc: "Remote", type: "Full-time" },
    { title: "Growth Marketing Manager", dept: "Marketing", loc: "New York, NY", type: "Full-time" },
    { title: "DevOps Engineer", dept: "Engineering", loc: "Remote", type: "Contract" },
  ];

  return (
    <div className="space-y-4 animate-in">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="flex-1 h-10 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3 gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <div className="h-2.5 w-40 bg-gray-200 rounded" />
        </div>
        <div className="h-10 w-28 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
          <div className="h-2.5 w-16 bg-gray-300 rounded" />
        </div>
      </div>
      {/* Results count */}
      <div className="h-2.5 w-36 bg-gray-200 rounded" />
      {/* Job cards */}
      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.title} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group">
            <div className="w-10 h-10 bg-blue-50 rounded-lg shrink-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{job.title}</p>
              <p className="text-xs text-gray-500">{job.dept} · {job.loc}</p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{job.type}</span>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
