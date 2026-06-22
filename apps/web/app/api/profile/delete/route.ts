/*
 * POST /api/profile/delete — candidate account erasure (GDPR §17, ADR-0011).
 * Anonymize-in-place via dataRightsRepo: PII destroyed, non-identifying decision +
 * audit records retained; deferred under legal hold. Own account only (email+tenant).
 * CSRF via the web middleware (same-origin). Flag-gated. Requires an explicit confirm.
 */

import path from "path";
import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { dataRightsRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { createStorage } from "@career-builder/shared/storage";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  if (!isEnabled("data_deletion")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  let body: { confirm?: unknown } = {};
  try { body = await req.json(); } catch { /* require confirm below */ }
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400, headers: NO_STORE });
  }

  const result = await dataRightsRepo.deleteCandidateData(session.tenantId, session.email, new Date());

  if (result.deferred) {
    return NextResponse.json(
      { deferred: true, message: "Your deletion request is on hold due to a legal retention requirement and will be completed once that hold is lifted." },
      { headers: NO_STORE },
    );
  }

  // Complete §17 erasure: delete the résumé blobs (storage lives outside the DB
  // layer, so the route does it with the keys the orchestrator returned).
  // Best-effort + after the DB commit — a storage hiccup never resurrects the PII.
  if (result.resumeKeys.length > 0) {
    try {
      const storage = createStorage({
        localDir: path.join(process.cwd(), "data", "resumes"),
        localPublicPrefix: "/data/resumes",
        keyPrefix: "resumes",
        tenantId: session.tenantId,
      });
      await Promise.allSettled(result.resumeKeys.map((k) => storage.delete(k)));
    } catch (err) {
      console.error("[profile/delete] résumé blob cleanup failed (DB already erased):", err);
    }
  }

  // The Candidate row is gone — the session is now orphaned; the client should log out.
  return NextResponse.json({ success: true, message: "Your data has been deleted." }, { headers: NO_STORE });
}
