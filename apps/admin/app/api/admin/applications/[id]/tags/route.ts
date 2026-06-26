/*
 * Admin per-application tag links API (ADR-0016, B2b).
 *
 * POST   — add a tag to this application   ({ tagId })
 * DELETE — remove a tag from this application ({ tagId })
 *
 * Flag-gated (application_tags). Tenant isolation: BOTH the application and the tag
 * are verified to belong to the caller's tenant before the link is touched — this is
 * the cross-tenant-sensitive surface, so a foreign application id OR a foreign tag id
 * → 404 (never link/unlink across tenants). Add is idempotent (re-add = no-op).
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, tagRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, applicationTagMutationSchema } from "@career-builder/security/validate";
import { canAccessJob } from "@/lib/hiringTeams";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const flagOff = () => !isEnabled("application_tags");

/** Shared guard: flag + auth + role + CSRF + tenant-owned application + tenant-owned tag. */
async function authorize(req: Request, applicationId: string, body: unknown) {
  if (flagOff()) return { error: NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE }) };
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE }) };
  if (!WRITE_ROLES.includes(session.role)) return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE }) };
  if (!(await validateCsrf(req))) return { error: NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE }) };

  const parsed = safeParse(applicationTagMutationSchema, body);
  if (!parsed.success) return { error: NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE }) };

  const app = await applicationRepo.findByIdScoped(applicationId, session.tenantId);
  if (!app || !(await canAccessJob(session, app.jobId))) return { error: NextResponse.json({ error: "Application not found." }, { status: 404, headers: NO_STORE }) };
  const tag = await tagRepo.findByIdScoped(parsed.data.tagId, session.tenantId);
  if (!tag) return { error: NextResponse.json({ error: "Tag not found." }, { status: 404, headers: NO_STORE }) };

  return { session, tagId: parsed.data.tagId };
}

/* ----------------------------------------------------------------- POST */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }

  const auth = await authorize(req, id, body);
  if (auth.error) return auth.error;
  const { session, tagId } = auth;

  await tagRepo.addToApplication(session.tenantId, id, tagId, session.userId);
  await writeAuditLog(session.userId, session.email, "application_tag_add", `application ${id.slice(-6)} ← tag ${tagId.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}

/* -------------------------------------------------------------- DELETE */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }

  const auth = await authorize(req, id, body);
  if (auth.error) return auth.error;
  const { session, tagId } = auth;

  await tagRepo.removeFromApplication(session.tenantId, id, tagId);
  await writeAuditLog(session.userId, session.email, "application_tag_remove", `application ${id.slice(-6)} ✕ tag ${tagId.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
