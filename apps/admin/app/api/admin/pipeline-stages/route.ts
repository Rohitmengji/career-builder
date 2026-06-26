/*
 * Admin Pipeline Stages API (ADR-0015, B1b). Manage the per-tenant pipeline.
 *
 * GET    — list the tenant's stages (recruiter+; needed for the assignment dropdown)
 * POST   — add a custom stage (manager+)
 * PATCH  — { action: "reorder", orderedIds } | { action: "update", id, ... } (manager+)
 *
 * Flag-gated (custom_pipeline_stages). `Application.status` stays canonical; a stage's
 * `kind` maps to a canonical status at assignment time (shared/pipeline.statusForStage).
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { stageRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { isStageKind } from "@career-builder/shared/pipeline";
import { sanitizeString } from "@career-builder/security/sanitize";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MANAGE_ROLES = ["super_admin", "admin", "hiring_manager"];
const REQUIRED_KINDS = ["applied", "offer", "hired", "rejected"]; // pipeline must always cover these
const flagOff = () => !isEnabled("custom_pipeline_stages");

function slugify(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "stage";
}

/* ------------------------------------------------------------------ GET */
export async function GET() {
  if (flagOff()) return NextResponse.json({ stages: [], enabled: false }, { headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const stages = await stageRepo.listForTenant(session.tenantId);
  return NextResponse.json({ enabled: true, stages: stages.map((s) => ({ id: s.id, key: s.key, label: s.label, kind: s.kind, order: s.order, color: s.color, isActive: s.isActive, isTerminal: s.isTerminal })) }, { headers: NO_STORE });
}

/* ----------------------------------------------------------------- POST */
export async function POST(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: { label?: unknown; kind?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const label = typeof body?.label === "string" ? sanitizeString(body.label, 60) : "";
  const kind = typeof body?.kind === "string" ? body.kind : "";
  if (!label) return NextResponse.json({ error: "A label is required." }, { status: 400, headers: NO_STORE });
  if (!isStageKind(kind)) return NextResponse.json({ error: "Invalid stage kind." }, { status: 400, headers: NO_STORE });

  const existing = await stageRepo.listForTenant(session.tenantId);
  // Unique key within the tenant pipeline; append an ITERATIVE numeric suffix so a
  // second collision (e.g. a retired stage already holding `key_N`) can't slip past.
  const taken = new Set(existing.map((s) => s.key));
  let key = slugify(label);
  if (taken.has(key)) {
    let n = existing.length;
    while (taken.has(`${key}_${n}`)) n += 1;
    key = `${key}_${n}`;
  }
  const order = existing.reduce((m, s) => Math.max(m, s.order), -1) + 1;

  let stage;
  try {
    stage = await stageRepo.create({ tenantId: session.tenantId, key, label, kind, order });
  } catch (err) {
    // Defense-in-depth: a concurrent create racing the same key → 409, not a 500.
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A stage with that name already exists." }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  await writeAuditLog(session.userId, session.email, "pipeline_stage_create", `${label} (${kind})`);
  return NextResponse.json({ stage: { id: stage.id, key: stage.key, label: stage.label, kind: stage.kind, order: stage.order, isActive: stage.isActive } }, { status: 201, headers: NO_STORE });
}

/* --------------------------------------------------------------- PATCH */
export async function PATCH(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: { action?: unknown; orderedIds?: unknown; id?: unknown; label?: unknown; color?: unknown; isActive?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }

  if (body.action === "reorder") {
    const ids = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0) return NextResponse.json({ error: "orderedIds required." }, { status: 400, headers: NO_STORE });
    await stageRepo.reorder(session.tenantId, ids);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  }

  if (body.action === "update") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400, headers: NO_STORE });
    const stage = await stageRepo.findByIdScoped(id, session.tenantId);
    if (!stage) return NextResponse.json({ error: "Stage not found." }, { status: 404, headers: NO_STORE });

    const data: { label?: string; color?: string | null; isActive?: boolean } = {};
    if (typeof body.label === "string") data.label = sanitizeString(body.label, 60);
    if (typeof body.color === "string" || body.color === null) data.color = body.color ? sanitizeString(String(body.color), 16) : null;
    if (typeof body.isActive === "boolean") {
      // Guard: never deactivate the LAST active stage of a required kind.
      if (body.isActive === false && REQUIRED_KINDS.includes(stage.kind) && stage.isActive) {
        const remaining = await stageRepo.countActiveByKind(session.tenantId, stage.kind);
        if (remaining <= 1) {
          return NextResponse.json({ error: `Can't remove the last "${stage.kind}" stage — the pipeline must always have one.` }, { status: 400, headers: NO_STORE });
        }
      }
      data.isActive = body.isActive;
    }
    await stageRepo.update(id, session.tenantId, data);
    await writeAuditLog(session.userId, session.email, "pipeline_stage_update", `stage ${id.slice(-6)}`);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400, headers: NO_STORE });
}
