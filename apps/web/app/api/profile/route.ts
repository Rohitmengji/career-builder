/*
 * GET   /api/profile — current candidate's full profile.
 * PATCH /api/profile — update editable profile fields.
 *
 * Requires an authenticated candidate session.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidateAuth";
import { candidateRepo } from "@career-builder/database";
import { sanitizeString } from "@career-builder/security/sanitize";
import { validateUrl } from "@career-builder/security/url";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";

function publicProfile(c: {
  id: string; email: string; firstName: string; lastName: string;
  phone: string | null; location: string | null; linkedinUrl: string | null;
  resumeUrl: string | null; headline: string | null; bio: string | null;
}) {
  return {
    id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName,
    phone: c.phone, location: c.location, linkedinUrl: c.linkedinUrl,
    resumeUrl: c.resumeUrl, headline: c.headline, bio: c.bio,
  };
}

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const candidate = await candidateRepo.findById(session.candidateId, session.tenantId);
  if (!candidate || !candidate.isActive) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ profile: publicProfile(candidate) });
}

const updateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  headline: z.string().max(140).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  linkedinUrl: z.string().max(300).optional().nullable(),
});

export async function PATCH(request: Request) {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit profile updates
  const limiter = getRateLimiter("api");
  const ip = getClientIp(request) || "unknown";
  if (!limiter.check(`profile:${session.candidateId}:${ip}`).allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  // Validate LinkedIn URL (https + linkedin.com) if provided & non-empty.
  if (d.linkedinUrl && d.linkedinUrl.trim()) {
    const r = validateUrl(d.linkedinUrl.trim(), {
      allowedProtocols: ["https:"],
      allowedHosts: ["linkedin.com", "www.linkedin.com"],
    });
    if (!r.valid) return NextResponse.json({ error: `Invalid LinkedIn URL: ${r.error}` }, { status: 400 });
  }

  try {
    const updated = await candidateRepo.updateProfile(session.candidateId, session.tenantId, {
      ...(d.firstName !== undefined ? { firstName: sanitizeString(d.firstName, 100) } : {}),
      ...(d.lastName !== undefined ? { lastName: sanitizeString(d.lastName, 100) } : {}),
      ...(d.phone !== undefined ? { phone: d.phone ? sanitizeString(d.phone, 30) : null } : {}),
      ...(d.location !== undefined ? { location: d.location ? sanitizeString(d.location, 120) : null } : {}),
      ...(d.headline !== undefined ? { headline: d.headline ? sanitizeString(d.headline, 140) : null } : {}),
      ...(d.bio !== undefined ? { bio: d.bio ? sanitizeString(d.bio, 2000) : null } : {}),
      ...(d.linkedinUrl !== undefined ? { linkedinUrl: d.linkedinUrl?.trim() || null } : {}),
    });
    return NextResponse.json({ success: true, profile: publicProfile(updated) });
  } catch (err) {
    console.error("[api/profile] update failed:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 400 });
  }
}
