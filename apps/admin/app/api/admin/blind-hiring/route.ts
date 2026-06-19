/*
 * Blind-hiring settings (tenant admin).
 *
 * GET /api/admin/blind-hiring  → current config for the session tenant
 * PUT /api/admin/blind-hiring  → { enabled, fields? }  (CSRF, admin+, audited)
 *
 * Stored in Tenant.settings.blindHiring (JSON; no migration). Tenant-scoped.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { tenantRepo } from "@career-builder/database";
import { parseBlindHiring, REDACTABLE_FIELDS } from "@career-builder/shared/blind-hiring";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { z } from "zod";

const NO_STORE = { "Cache-Control": "no-store" } as const;
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}
const canManage = (role: string) => role === "admin" || role === "super_admin";

const putSchema = z.object({
  enabled: z.boolean(),
  fields: z.array(z.enum(REDACTABLE_FIELDS)).optional(),
}).strict();

export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) return json({ error: "Unauthorized" }, 401);
  const tenant = await tenantRepo.findById(session.tenantId);
  return json({
    config: parseBlindHiring((tenant as { settings?: unknown } | null)?.settings),
    availableFields: REDACTABLE_FIELDS,
    globallyEnabled: isEnabled("blind_hiring"),
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (!canManage(session.role)) return json({ error: "Insufficient permissions" }, 403);
  if (!(await validateCsrf(req))) return json({ error: "Invalid CSRF token" }, 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid blind-hiring config." }, 400);

  // Merge into the tenant's existing settings JSON (don't clobber other keys).
  const tenant = await tenantRepo.findById(session.tenantId);
  let settings: Record<string, unknown> = {};
  try {
    const raw = (tenant as { settings?: unknown } | null)?.settings;
    settings = (typeof raw === "string" ? JSON.parse(raw) : raw) || {};
  } catch {
    settings = {};
  }
  settings.blindHiring = {
    enabled: parsed.data.enabled,
    fields: parsed.data.fields ?? [...REDACTABLE_FIELDS],
  };

  await tenantRepo.update(session.tenantId, { settings: JSON.stringify(settings) });
  await writeAuditLog(
    session.userId,
    session.email,
    "blind_hiring_update",
    `blindHiring.enabled=${parsed.data.enabled}`,
  );

  return json({ success: true, config: settings.blindHiring });
}
