/*
 * POST /api/auth/register — create a candidate account + start a session.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { registerCandidate } from "@/lib/candidateAuth";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";
import { sanitizeString, sanitizeEmail } from "@career-builder/security/sanitize";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
});

export async function POST(request: Request) {
  try {
    const limiter = getRateLimiter("auth");
    const ip = getClientIp(request) || "unknown";
    if (!limiter.check(`register:${ip}`).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const email = sanitizeEmail(parsed.data.email);
    if (!email) return NextResponse.json({ error: "Invalid email format" }, { status: 400 });

    const result = await registerCandidate({
      email,
      password: parsed.data.password,
      firstName: sanitizeString(parsed.data.firstName, 100),
      lastName: sanitizeString(parsed.data.lastName, 100),
      phone: parsed.data.phone ? sanitizeString(parsed.data.phone, 30) : undefined,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, candidate: result.candidate }, { status: 201 });
  } catch (err) {
    console.error("[api/auth/register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
