/**
 * AI Memory — API Route
 *
 * GET  /api/ai/memory — load memory for current tenant
 * POST /api/ai/memory — record accepted/rejected feedback
 *
 * Auth-protected, CSRF-protected on POST.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf } from "@/lib/auth";
import { loadMemory, saveMemory, recordAccepted, recordRejected, recordStructure } from "@/lib/ai/context/memorySystem";

/* ================================================================== */
/*  GET — load tenant memory                                           */
/* ================================================================== */

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionReadOnly();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.tenantId || "default";
    const memory = await loadMemory(tenantId);

    return NextResponse.json({
      tenantId: memory.tenantId,
      stats: {
        totalGenerations: memory.totalGenerations,
        acceptedBlocks: memory.acceptedBlocks.length,
        rejectedBlocks: memory.rejectedBlocks.length,
        successfulStructures: memory.successfulStructures.length,
        toneHistory: memory.toneHistory.length,
      },
      preferredTone: memory.toneHistory.length > 0
        ? memory.toneHistory[memory.toneHistory.length - 1]
        : null,
      topAcceptedBlocks: getTopItems(memory.acceptedBlocks, 5),
      topRejectedBlocks: getTopItems(memory.rejectedBlocks, 5),
    });
  } catch (err) {
    console.error("[API /ai/memory] GET error:", err);
    return NextResponse.json({ error: "Failed to load memory" }, { status: 500 });
  }
}

/* ================================================================== */
/*  POST — record feedback                                             */
/* ================================================================== */

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const csrfErr = await validateCsrf(req);
    if (csrfErr) {
      return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    }

    const body = await req.json();
    const { action, blockTypes } = body;

    if (!action || !Array.isArray(blockTypes) || blockTypes.length === 0) {
      return NextResponse.json(
        { error: "Required: action ('accepted' | 'rejected') and blockTypes (string[])" },
        { status: 400 },
      );
    }

    if (action !== "accepted" && action !== "rejected") {
      return NextResponse.json(
        { error: "action must be 'accepted' or 'rejected'" },
        { status: 400 },
      );
    }

    // Sanitize block types — only allow known types
    const validBlockTypes = blockTypes.filter(
      (t: unknown) => typeof t === "string" && t.length > 0 && t.length < 100,
    );

    if (validBlockTypes.length === 0) {
      return NextResponse.json({ error: "No valid block types provided" }, { status: 400 });
    }

    const tenantId = session.tenantId || "default";
    const memory = await loadMemory(tenantId);

    let updated;
    if (action === "accepted") {
      updated = recordAccepted(memory, validBlockTypes);
      // If it looks like a full page (3+ blocks), also record structure
      if (validBlockTypes.length >= 3) {
        updated = recordStructure(updated, validBlockTypes);
      }
    } else {
      updated = recordRejected(memory, validBlockTypes);
    }

    await saveMemory(updated);

    console.log(`[API /ai/memory] Recorded ${action} for ${validBlockTypes.length} blocks (tenant: ${tenantId})`);

    return NextResponse.json({
      success: true,
      totalGenerations: updated.totalGenerations,
    });
  } catch (err) {
    console.error("[API /ai/memory] POST error:", err);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Count frequency and return top N items */
function getTopItems(items: string[], n: number): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([type, count]) => ({ type, count }));
}
