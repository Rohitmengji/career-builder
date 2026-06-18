import React from "react";
import { Container, Section, SectionHeader, Card } from "@/components/ui";

const CHECK = (
  <span className="inline-flex items-center justify-center">
    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
    <span className="sr-only">Included</span>
  </span>
);

const CROSS = (
  <span className="inline-flex items-center justify-center">
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
    <span className="sr-only">Not available</span>
  </span>
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

function cell(value: boolean | string, accent = false) {
  if (typeof value === "boolean") return value ? CHECK : CROSS;
  return (
    <span className={`text-sm font-${accent ? "bold" : "medium"} whitespace-nowrap ${accent ? "text-blue-700" : "text-gray-600"}`}>
      {value}
    </span>
  );
}

export default function Comparison() {
  return (
    <Section id="comparison" muted>
      <Container className="max-w-4xl">
        <SectionHeader
          eyebrow="How we compare"
          title="Built different"
          subtitle="See how HireBase stacks up against traditional ATS platforms."
        />

        {/* Table — horizontal scroll on mobile */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-125" aria-label="Feature comparison between HireBase, Workable, and Lever">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th scope="col" className="text-left text-sm font-semibold text-gray-600 px-4 sm:px-6 py-4">Feature</th>
                  <th scope="col" className="text-center text-sm font-bold text-blue-700 px-3 sm:px-4 py-4 bg-blue-50/60">HireBase</th>
                  <th scope="col" className="text-center text-sm font-semibold text-gray-600 px-3 sm:px-4 py-4">Workable</th>
                  <th scope="col" className="text-center text-sm font-semibold text-gray-600 px-3 sm:px-4 py-4">Lever</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f, i) => (
                  <tr
                    key={f.name}
                    className={`transition-colors hover:bg-gray-50 ${i < FEATURES.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <th scope="row" className="text-left text-sm text-gray-700 font-medium px-4 sm:px-6 py-4 whitespace-nowrap">{f.name}</th>
                    <td className="text-center px-3 sm:px-4 py-4 bg-blue-50/40">{cell(f.us, true)}</td>
                    <td className="text-center px-3 sm:px-4 py-4">{cell(f.workable)}</td>
                    <td className="text-center px-3 sm:px-4 py-4">{cell(f.lever)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
