import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf } from "@/lib/auth";
import { tenantRepo } from "@career-builder/database";
import { stripHtml } from "@career-builder/security/sanitize";

const MAX_CONTEXT_BYTES = 20_000; // cap stored AI context to prevent abuse

/**
 * Coerce arbitrary client input into a safe, bounded AI-context object:
 * plain object only, string values stripped of HTML/scripts and length-capped.
 * (The context is later injected into AI prompts, so it must be sanitized.)
 */
function sanitizeContext(input: unknown): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 100) continue;
    if (v == null) continue;
    if (Array.isArray(v)) {
      // String arrays (e.g. pageSlugs) — sanitize + cap count/length.
      out[k] = v
        .filter((x): x is string => typeof x === "string")
        .slice(0, 100)
        .map((x) => stripHtml(x).slice(0, 200));
      continue;
    }
    const raw = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
    if (!raw) continue;
    out[k] = stripHtml(raw).slice(0, 5000);
  }
  return out;
}

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

  const body = await req.json().catch(() => null);

  // Reject oversized payloads before doing any work.
  if (body == null || JSON.stringify(body).length > MAX_CONTEXT_BYTES) {
    return NextResponse.json({ error: "Invalid or too-large context" }, { status: 400 });
  }

  const key = session.tenantId || "default";
  const settings = await getSettings(key);
  settings.aiSiteContext = sanitizeContext(body);
  await saveSettings(key, settings);

  return NextResponse.json({ ok: true });
}
