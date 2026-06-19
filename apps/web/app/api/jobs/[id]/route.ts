/*
 * Job Detail API — returns a single job by ID.
 *
 * GET /api/jobs/[id]?tenantId=default
 *
 * Returns: { job, relatedJobs }
 */

import { NextResponse } from "next/server";
import { getJobProvider } from "@/lib/jobs/provider";
import { getWebTenantId, isMultiTenantWeb } from "@/lib/tenant-runtime";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(_request.url);
    // When multi-tenant is active, the host decides the tenant — never the
    // client query param (prevents cross-tenant job reads).
    const tenantId = isMultiTenantWeb()
      ? await getWebTenantId()
      : url.searchParams.get("tenantId") || undefined;

    const provider = getJobProvider();
    const result = await provider.getById(id, tenantId);

    if (!result.job) {
      return NextResponse.json(
        { job: null, relatedJobs: [], error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[API /api/jobs/[id]] Error:", error);
    return NextResponse.json(
      { job: null, relatedJobs: [], error: "Internal server error" },
      { status: 500 }
    );
  }
}
