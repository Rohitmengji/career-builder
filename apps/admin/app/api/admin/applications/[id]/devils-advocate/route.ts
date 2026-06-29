/*
 * POST /api/admin/applications/[id]/devils-advocate — pre-decision counter-argument
 * (ADR-0032). NOVEL: before a recruiter rejects or hires, an AI argues the STRONGEST
 * evidence-based case for the OPPOSITE, to counter confirmation bias.
 *
 * Body: { proposedDecision?: "reject" | "hire" }. When omitted, the decision being
 * challenged is derived from the scorecard recommendation lean. The model gets ONLY the
 * job requirements + structured-interview averages + a non-identifying recommendation
 * mix — NEVER candidate PII (no name/résumé/contact). Recruiter+; tenant- + hiring-team-
 * scoped; CSRF; flag-gated (ai_devils_advocate). Advisory — never blocks a decision.
 * Fail-closed. KV-cached on the evidence hash + decision + prompt version. Each run
 * writes an ai_oversight audit row (EU AI-Act §14 human-oversight trail).
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, scorecardRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { aggregateScorecards, parseScorecardCriteria, type ScorecardInput } from "@career-builder/shared/scorecard";
import { getKV } from "@career-builder/shared/kv";
import { sha256 } from "@career-builder/security/crypto";
import { canAccessJob } from "@/lib/hiringTeams";
import { argueAgainst, selectGroundingCriteria, DEVILS_ADVOCATE_PROMPT_VERSION, type ProposedDecision, type DevilsAdvocateResult } from "@career-builder/ai-client/devils-advocate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Parse Job.requirements (a JSON array string, or newline text fallback). */
function parseRequirements(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 30);
  } catch { /* not JSON */ }
  return raw.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30);
}

const REC_LABELS: Record<string, string> = { strong_yes: "strong yes", yes: "yes", no: "no", strong_no: "strong no" };
function recommendationSummary(counts: Record<string, number>): string {
  const parts = (["strong_yes", "yes", "no", "strong_no"] as const)
    .filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${REC_LABELS[k]}`);
  return parts.length ? parts.join(", ") : "no recommendations yet";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("ai_devils_advocate")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: { proposedDecision?: unknown } = {};
  try { body = await req.json(); } catch { /* body optional */ }
  const requested = body?.proposedDecision;
  const explicit: ProposedDecision | null = requested === "reject" || requested === "hire" ? requested : null;

  // Tenant + hiring-team scope: the application must be one this user may access.
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app || !(await canAccessJob(session, app.jobId))) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  // EU AI-Act §14 human-oversight trail — best-effort (an audit-write hiccup must never
  // sink an otherwise-good advisory result), tenant-scoped, no candidate identity.
  const recordOversight = async (detail: string) => {
    try { await writeAuditLog(session.userId, session.email, "ai_oversight", detail, session.tenantId); } catch { /* best-effort */ }
  };

  // Evidence = the structured interview scores. No scorecards → nothing to ground on.
  const scorecards = await scorecardRepo.listForApplication(session.tenantId, id);
  const agg = aggregateScorecards(
    scorecards.map((s) => ({ interviewerId: s.interviewerId, recommendation: s.recommendation as ScorecardInput["recommendation"], ratings: s.ratings.map((r) => ({ criterion: r.criterion, score: r.score })) })),
  );
  if (agg.total === 0) {
    await recordOversight(`devils_advocate ${id.slice(-6)} (no scorecards)`);
    return NextResponse.json(
      { available: true, proposedDecision: explicit ?? "reject", points: [], caution: "No structured interview scores yet — add scorecards to get an evidence-grounded counter-case.", promptVersion: DEVILS_ADVOCATE_PROMPT_VERSION } satisfies DevilsAdvocateResult,
      { headers: NO_STORE },
    );
  }

  // Decision being challenged: explicit body, else derived from the recommendation lean
  // (positive → leaning hire; otherwise leaning reject — the bias we most want to check).
  const lean = agg.recommendationLean ?? 0;
  const proposedDecision: ProposedDecision = explicit ?? (lean > 0 ? "hire" : "reject");

  // PII GUARD: criterion labels are free text on the rating rows and are NOT validated
  // against the job rubric at write time, so a recruiter could smuggle PII into a label.
  // Send ONLY labels that are members of the canonical job rubric (job-level, PII-safe like
  // the requirements); drop any off-rubric/legacy label rather than forward it to the AI.
  const rubric = parseScorecardCriteria((app.job as { scorecardCriteria?: unknown } | null)?.scorecardCriteria);
  const input = {
    proposedDecision,
    jobTitle: app.job?.title ?? "this role",
    requirements: parseRequirements(app.job?.requirements),
    criteria: selectGroundingCriteria(agg.perCriterion, rubric),
    recommendationSummary: recommendationSummary(agg.recommendationCounts),
  };

  // Cache on the evidence CONTENT + decision + prompt version (re-runs free until evidence changes).
  const contentHash = sha256(JSON.stringify(input)).slice(0, 16);
  const kv = getKV();
  const cacheKey = `devils-advocate:${session.tenantId}:${id}:${proposedDecision}:${DEVILS_ADVOCATE_PROMPT_VERSION}:${contentHash}`;
  let result: DevilsAdvocateResult | null = null;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) result = JSON.parse(cached) as DevilsAdvocateResult;
  } catch { /* cache miss */ }

  if (!result) {
    result = await argueAgainst(input);
    if (result.available) {
      try { await kv.set(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS); } catch { /* best-effort */ }
    }
  }

  await recordOversight(`devils_advocate ${id.slice(-6)} vs ${proposedDecision} (${result.available ? result.points.length + " points" : "unavailable"})`);
  return NextResponse.json(result, { headers: NO_STORE });
}
