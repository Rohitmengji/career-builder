/*
 * POST /api/admin/jobs/bias-check — AI job-description bias check (ADR-0014).
 *
 * Advisory, non-blocking EU AI-Act safeguard: returns suggestions, never blocks a
 * publish. Job authors only (hiring_manager+). Flag-gated; fail-closed. Records a
 * human-oversight audit entry (AI Act §14) that AI assistance was used + reviewed.
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { detectJdBias } from "@career-builder/ai-client/jd-bias";
import { stripHtml } from "@career-builder/security/sanitize";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const AUTHOR_ROLES = ["super_admin", "admin", "hiring_manager"];

export async function POST(req: Request) {
  if (!isEnabled("ai_jd_bias_detection")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!AUTHOR_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: { description?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const description = typeof body?.description === "string" ? stripHtml(body.description).slice(0, 20_000) : "";

  const result = await detectJdBias(description);

  // Human-oversight record (AI Act §14): a person ran + reviewed the AI suggestion.
  await writeAuditLog(session.userId, session.email, "ai_oversight", `jd_bias_check (${result.available ? result.findings.length + " findings" : "unavailable"})`);

  return NextResponse.json(result, { headers: NO_STORE });
}
