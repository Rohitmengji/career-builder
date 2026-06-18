/*
 * POST /api/auth/logout — destroy the candidate session.
 */

import { NextResponse } from "next/server";
import { clearSession } from "@/lib/candidateAuth";

export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}
