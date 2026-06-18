/*
 * POST /api/auth/login — verify candidate credentials + start a session.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { loginCandidate } from "@/lib/candidateAuth";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const limiter = getRateLimiter("auth");
    const ip = getClientIp(request) || "unknown";
    if (!limiter.check(`login:${ip}`).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const result = await loginCandidate(parsed.data.email, parsed.data.password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
    return NextResponse.json({ success: true, candidate: result.candidate });
  } catch (err) {
    console.error("[api/auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
