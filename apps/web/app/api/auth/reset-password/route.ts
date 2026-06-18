/*
 * POST /api/auth/reset-password — set a new password using a reset token.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithToken } from "@/lib/candidateAuth";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";

const schema = z.object({
  token: z.string().min(1).max(256),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(request: Request) {
  try {
    const limiter = getRateLimiter("auth");
    const ip = getClientIp(request) || "unknown";
    if (!limiter.check(`reset:${ip}`).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/reset-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
