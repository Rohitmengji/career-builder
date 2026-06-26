/*
 * POST /api/admin/applications/[id]/scorecards/audit — AI scorecard bias/consistency
 * linter (ADR-0026). NOVEL: audits the EVALUATION, not the candidate.
 *
 * Body: { scorecardId }. Runs ai-client/scorecard-audit over ONE scorecard (the
 * recruiter's own written scores + comments) and returns fairness/quality flags.
 * Internal-only; never candidate-visible. Recruiter+; tenant- + hiring-team-scoped;
 * CSRF; flag-gated (ai_scorecard_audit). Fail-closed. KV-cached on the scorecard's
 * content hash + prompt version (re-runs are free until the scorecard changes). Each
 * run writes an ai_oversight audit row (EU AI-Act §14 human-oversight trail).
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, scorecardRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { getKV } from "@career-builder/shared/kv";
import { sha256 } from "@career-builder/security/crypto";
import { canAccessJob } from "@/lib/hiringTeams";
import { auditScorecard, SCORECARD_AUDIT_PROMPT_VERSION, type ScorecardAuditResult } from "@career-builder/ai-client/scorecard-audit";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("ai_scorecard_audit")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: { scorecardId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const scorecardId = typeof body?.scorecardId === "string" ? body.scorecardId : "";
  if (!scorecardId) return NextResponse.json({ error: "scorecardId is required." }, { status: 400, headers: NO_STORE });

  // Tenant + hiring-team scope: the scorecard's application must be one this user may access.
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app || !(await canAccessJob(session, app.jobId))) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  // Find the scorecard within this (tenant-scoped) application — no cross-app/tenant id.
  const scorecards = await scorecardRepo.listForApplication(session.tenantId, id);
  const sc = scorecards.find((s) => s.id === scorecardId);
  if (!sc) return NextResponse.json({ error: "Scorecard not found." }, { status: 404, headers: NO_STORE });

  const input = {
    recommendation: sc.recommendation,
    overallNotes: sc.overallNotes,
    ratings: sc.ratings.map((r) => ({ criterion: r.criterion, score: r.score, comment: r.comment })),
  };

  // Cache on the evaluation CONTENT (so editing the scorecard re-audits) + prompt version.
  const contentHash = sha256(JSON.stringify(input)).slice(0, 16);
  const kv = getKV();
  const cacheKey = `scorecard-audit:${session.tenantId}:${scorecardId}:${SCORECARD_AUDIT_PROMPT_VERSION}:${contentHash}`;
  let result: ScorecardAuditResult | null = null;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) result = JSON.parse(cached) as ScorecardAuditResult;
  } catch { /* cache miss */ }

  if (!result) {
    result = await auditScorecard(input);
    if (result.available) {
      try { await kv.set(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS); } catch { /* best-effort */ }
    }
  }

  // EU AI-Act §14 human-oversight trail (no candidate identity in the detail).
  await writeAuditLog(session.userId, session.email, "ai_oversight", `scorecard_audit ${scorecardId.slice(-6)} (${result.available ? result.flags.length + " flags" : "unavailable"})`);
  return NextResponse.json(result, { headers: NO_STORE });
}
