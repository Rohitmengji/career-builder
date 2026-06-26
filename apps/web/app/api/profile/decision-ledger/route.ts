/*
 * GET /api/profile/decision-ledger — the candidate's sealed decision receipt(s).
 *
 * The reader half of ADR-0027. For the candidate's OWN applications (matched by
 * lowercased email within their tenant, like /api/profile/views), it RE-DERIVES the
 * candidate-safe ledger from the live record (the SAME decisionLedgerRepo.buildInput +
 * shared entriesFromRaw the writer used) and compares against the digest sealed at the
 * decision: "verified" (untouched), "modified" (edited after the decision), or
 * "unsealed". Flag-gated (decision_ledger); own-only; no-store.
 *
 * Optional ?applicationId returns just that one (must be the caller's own).
 */

import { NextResponse } from "next/server";
import { getCurrentCandidate } from "@/lib/candidateAuth";
import { applicationRepo, decisionLedgerRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { entriesFromRaw, seal, verify } from "@career-builder/shared/decision-ledger";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(req: Request) {
  if (!isEnabled("decision_ledger")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });

  const requested = new URL(req.url).searchParams.get("applicationId");
  const ownIds = await applicationRepo.findIdsByEmail(candidate.tenantId, candidate.email);
  // Own-only: a requested id must be in the caller's own set, else nothing (no leak).
  const targetIds = requested ? (ownIds.includes(requested) ? [requested] : []) : ownIds;

  // The curated reason is shown to candidates only when the adverse-disclosure feature
  // is on (matching /api/applications). To keep the SEAL stable across flag toggles,
  // we verify over the FULL content (reason included if shared) but strip the reason
  // from the DISPLAY payload when the flag is off — display gating, not integrity gating.
  const showReason = isEnabled("adverse_action_disclosure");

  const ledgers = [];
  for (const id of targetIds) {
    const stored = await decisionLedgerRepo.getSeal(candidate.tenantId, id);
    // Only surface applications that actually reached a sealed terminal decision
    // (unless a specific id was requested — then show its true state incl. unsealed).
    if (!stored && !requested) continue;
    // Cap the status sequence at the sealed boundary so a later re-decision can't
    // false-flag this receipt as "modified".
    const asOf = stored?.boundaryAt ? new Date(stored.boundaryAt) : undefined;
    const raw = await decisionLedgerRepo.buildInput(candidate.tenantId, id, { statusesAsOf: asOf });
    const fullEntries = entriesFromRaw(raw);
    const verdict = verify(fullEntries, stored?.digest); // verify over full (stable)
    const entries = showReason ? fullEntries : fullEntries.filter((e) => e.kind !== "reason");
    ledgers.push({
      applicationId: id,
      entries,
      verdict,
      sealedAt: stored?.sealedAt ?? null,
      // The candidate's own copy of the digest (short, for display/"receipt no.").
      digest: stored?.digest ?? seal(fullEntries),
    });
  }

  return NextResponse.json({ ledgers }, { headers: NO_STORE });
}
