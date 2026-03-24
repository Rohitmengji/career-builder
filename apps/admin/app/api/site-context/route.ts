import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf } from "@/lib/auth";
import { tenantRepo } from "@career-builder/database";

/**
 * /api/site-context — persist / retrieve AI site context per tenant.
 *
 * Stored inside the tenant's `settings` JSON field under the key
 * "aiSiteContext". This survives server restarts and deployments.
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getSettings(tenantId: string): Promise<Record<string, any>> {
  try {
    const tenant = await tenantRepo.findById(tenantId);
    if (!tenant?.settings) return {};
    return JSON.parse(String(tenant.settings));
  } catch {
    return {};
  }
}

async function saveSettings(tenantId: string, settings: Record<string, any>): Promise<void> {
  await tenantRepo.update(tenantId, { settings: JSON.stringify(settings) });
}

/* ------------------------------------------------------------------ */
/*  GET — load context for current tenant                              */
/* ------------------------------------------------------------------ */
export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = session.tenantId || "default";
  const settings = await getSettings(key);
  return NextResponse.json({ context: settings.aiSiteContext || null });
}

/* ------------------------------------------------------------------ */
/*  POST — save context for current tenant                             */
/* ------------------------------------------------------------------ */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF" }, { status: 403 });
  }

  const body = await req.json();
  const key = session.tenantId || "default";
  const settings = await getSettings(key);
  settings.aiSiteContext = body;
  await saveSettings(key, settings);

  return NextResponse.json({ ok: true });
}
