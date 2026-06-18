/*
 * GET /api/auth/session — return the current candidate (or { authenticated:false }).
 */

import { NextResponse } from "next/server";
import { getCurrentCandidate } from "@/lib/candidateAuth";

export async function GET() {
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    candidate: {
      id: candidate.id,
      email: candidate.email,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
    },
  });
}
