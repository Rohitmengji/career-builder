/*
 * GET /api/admin/analytics/ghosting-risk — proactive "don't ghost" nudge (ADR-0033).
 *
 * Lists applications still awaiting a first response that are approaching or past the
 * 14-day responsiveness SLA, so recruiters act BEFORE they ghost. Recruiter+ (not
 * viewer); tenant-scoped; hiring-team-scoped (visibleJobIds); blind-hiring-aware (the
 * candidate name is redacted under blind hiring — the nudge itself, counts + days
 * waiting + role, is identity-free). Flag-gated (ghosting_risk_nudges). Read-only.
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { applicationRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { computeGhostingRisk } from "@career-builder/shared/ghosting-risk";
import { visibleJobIds } from "@/lib/hiringTeams";
import { getBlindHiringConfig } from "@/lib/blindHiring";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MAX_ITEMS = 25; // most-overdue first; cap the surfaced list

export async function GET() {
  if (!isEnabled("ghosting_risk_nudges")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  // Hiring-team scope: null = all jobs, [] = no access (→ no rows). Pass undefined for "all".
  const jobIds = await visibleJobIds(session);
  const pending = await applicationRepo.findPendingForGhostingRisk(session.tenantId, jobIds ?? undefined);

  const summary = computeGhostingRisk(
    pending.map((p) => ({ id: p.id, status: p.status, submittedAt: p.submittedAt })),
    new Date(),
  );

  // Join the actionable items back to their display fields; redact identity under blind hiring.
  const blind = await getBlindHiringConfig(session.tenantId);
  const byId = new Map(pending.map((p) => [p.id, p]));
  const items = summary.items.slice(0, MAX_ITEMS).map((it) => {
    const p = byId.get(it.id);
    const name = p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "";
    return {
      id: it.id,
      risk: it.risk,
      daysWaiting: it.daysWaiting,
      daysUntilSla: it.daysUntilSla,
      candidateName: blind.enabled ? null : name || null,
      jobTitle: p?.job?.title ?? null,
    };
  });

  return NextResponse.json({ atRisk: summary.atRisk, overdue: summary.overdue, items }, { headers: NO_STORE });
}
