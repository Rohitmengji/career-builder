/*
 * GET /api/admin/analytics/trust-index — Employer Trust Index (ADR-0029).
 *
 * The tenant's OWN responsiveness (the "we don't ghost" rate, which it owns) vs the
 * k-ANONYMIZED market of other employers. The market is computed cross-tenant from
 * aggregate counts (trustIndexRepo), then k-anon-gated by shared/trust-index
 * (>= TRUST_MIN_TENANTS = 10 contributing tenants) BEFORE it reaches the client — no other tenant's value or
 * identity is ever exposed. Recruiter+; flag-gated (employer_trust_index); read-only.
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { trustIndexRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { gradeFor, GHOST_SLA_DAYS, MIN_SETTLED, RESPONDED_STATUS_LIST } from "@career-builder/shared/responsiveness";
import { benchmarkMetric, bucketContributors, TRUST_MIN_TENANTS } from "@career-builder/shared/trust-index";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  if (!isEnabled("employer_trust_index")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  // Compute the viewer's OWN rate the SAME all-time count way as the market, so the
  // comparison is apples-to-apples (the public badge's recent-5000 window would skew the
  // percentile for high-volume tenants). Same SLA cutoff, floor, and status allow-list.
  const cutoff = new Date(Date.now() - GHOST_SLA_DAYS * DAY_MS);
  const respondedStatuses = [...RESPONDED_STATUS_LIST];
  const [own, marketRates] = await Promise.all([
    trustIndexRepo.getTenantResponsivenessRate(session.tenantId, { cutoff, minSettled: MIN_SETTLED, respondedStatuses }),
    trustIndexRepo.getMarketResponsivenessRates({ excludeTenantId: session.tenantId, cutoff, minSettled: MIN_SETTLED, respondedStatuses }),
  ]);

  const benchmark = benchmarkMetric(own.available ? own.responseRate : null, marketRates, {
    minTenants: TRUST_MIN_TENANTS,
    higherIsBetter: true,
  });

  return NextResponse.json(
    {
      responsiveness: {
        own: own.available ? { responseRate: own.responseRate, grade: gradeFor(own.responseRate), sampleSize: own.sampleSize } : null,
        // Send only k-anon-safe market fields — coarse percentiles + a BANDED contributor
        // count (never the exact tenant count, which is a temporal-differencing channel).
        benchmark: {
          available: benchmark.available,
          contributors: benchmark.available ? bucketContributors(benchmark.sampleTenants) : null,
          median: benchmark.median,
          p25: benchmark.p25,
          p75: benchmark.p75,
          percentile: benchmark.percentile,
        },
      },
    },
    { headers: NO_STORE },
  );
}
