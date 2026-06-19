/*
 * SalaryContext — "Salary Truth" market pay context (server component, display-only).
 *
 * Renders the k-anonymized market benchmark for a role: the market median range
 * and, when the employer posts pay, where it sits as a percentile. When pay is
 * hidden, the market range still shows (the honest part). Renders NOTHING when
 * the benchmark is suppressed/unavailable — the caller can mount it unconditionally.
 *
 * All privacy (k-anonymity, rounding) is already applied upstream
 * (computeSalaryBenchmark); this component only formats numbers.
 */

import * as React from "react";
import { Card, Badge } from "@/components/ui";
import type { SalaryBenchmark } from "@career-builder/shared/salary-benchmark";

function fmt(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain grouped number + code.
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
  }
}

const PERIOD_LABEL: Record<string, string> = {
  yearly: "/yr",
  monthly: "/mo",
  hourly: "/hr",
};

// Coarse, qualitative bands only — we deliberately never show an exact
// percentile or sample count, which at the k-anonymity floor could let an
// insider infer an individual posting (see ADR-0002 / review).
function percentileTone(p: number): "success" | "brand" | "warning" {
  if (p >= 67) return "success";
  if (p >= 34) return "brand";
  return "warning";
}

function percentileBandLabel(p: number): string {
  if (p >= 67) return "Above market";
  if (p >= 34) return "Around market rate";
  return "Below market";
}

function percentilePhrase(p: number): string {
  if (p >= 67) return "above most comparable roles";
  if (p >= 34) return "around the middle of the market";
  return "below most comparable roles";
}

export default function SalaryContext({ benchmark }: { benchmark: SalaryBenchmark | null }) {
  if (!benchmark || !benchmark.available || !benchmark.market) return null;

  const { currency, period, market, posted, percentile } = benchmark;
  const periodSuffix = PERIOD_LABEL[period] ?? "";
  const range = `${fmt(market.p25, currency)} – ${fmt(market.p75, currency)}${periodSuffix}`;
  const median = `${fmt(market.p50, currency)}${periodSuffix}`;

  return (
    <Card className="sm:p-8">
      <div className="mb-1.5 flex items-center gap-2">
        <SalaryIcon />
        <h2 className="text-lg font-semibold text-gray-900">Pay in context</h2>
        <Badge tone="brand">Market data</Badge>
      </div>

      {posted !== null && percentile !== null ? (
        <p className="mb-5 flex flex-wrap items-center gap-2 text-sm leading-relaxed text-gray-600">
          <Badge tone={percentileTone(percentile)}>{percentileBandLabel(percentile)}</Badge>
          <span>
            This role&apos;s posted pay sits{" "}
            <span className="font-medium text-gray-900">{percentilePhrase(percentile)}</span>.
          </span>
        </p>
      ) : (
        <p className="mb-5 max-w-[65ch] text-sm leading-relaxed text-gray-600">
          Here&apos;s what comparable roles pay — so you can go in informed.
        </p>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-gray-200/80 bg-gray-50 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Market range (mid 50%)
          </p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900">{range}</p>
        </div>
        <div className="flex-1 sm:border-l sm:border-gray-200 sm:pl-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Market median</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900">{median}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Estimated from comparable published roles across multiple employers. Figures are rounded and
        aggregated — individual salaries are never shown.
      </p>
    </Card>
  );
}

function SalaryIcon() {
  return (
    <svg
      className="h-5 w-5 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
