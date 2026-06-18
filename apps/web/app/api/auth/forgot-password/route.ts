/*
 * POST /api/auth/forgot-password — email a password-reset link.
 *
 * Always responds with success (never reveals whether an account exists) to
 * prevent account enumeration.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordResetToken } from "@/lib/candidateAuth";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";
import { emailService } from "@career-builder/email";

const schema = z.object({ email: z.string().email().max(254) });

export async function POST(request: Request) {
  const GENERIC = { success: true, message: "If an account exists for that email, a reset link has been sent." };
  try {
    const limiter = getRateLimiter("auth");
    const ip = getClientIp(request) || "unknown";
    if (!limiter.check(`forgot:${ip}`).allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json(GENERIC); // don't leak validation either

    const token = await createPasswordResetToken(parsed.data.email);
    if (token) {
      const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      const resetUrl = `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
      const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";

      if (process.env.NODE_ENV !== "production") {
        console.log(`[auth] Password reset link (dev): ${resetUrl}`);
      }
      // Fire-and-forget; never block (and never reveal send status).
      emailService
        .sendPasswordReset({ email: parsed.data.email, resetUrl, companyName, expiresInMinutes: 60 })
        .catch((e) => console.error("[auth] reset email failed:", e));
    }

    return NextResponse.json(GENERIC);
  } catch (err) {
    console.error("[api/auth/forgot-password]", err);
    return NextResponse.json(GENERIC); // still generic on error
  }
}
