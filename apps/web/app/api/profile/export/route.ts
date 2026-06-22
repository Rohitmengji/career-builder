/*
 * GET /api/profile/export — candidate data-subject export (GDPR §15, ADR-0011).
 * Returns the candidate's OWN data (profile + applications + interviews + offers +
 * consent history) as a downloadable JSON, scoped to email+tenant. The pure
 * `buildCandidateExport` whitelists fields — internal recruiter data + EEO never ship.
 * Flag-gated; rate-limited.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { candidateRepo, applicationRepo, interviewRepo, offerRepo, consentRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { buildCandidateExport } from "@career-builder/shared/data-export";
import { effectiveStatus } from "@career-builder/shared/offer";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(req: Request) {
  if (!isEnabled("data_export")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  // This GET streams a PII bundle, so block cross-site top-level navigations
  // (a malicious page force-downloading the victim's data). Same-origin/none only.
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403, headers: NO_STORE });
  }
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { email, tenantId } = session;
  const now = new Date();
  const [profile, applications, interviews, offers, consents] = await Promise.all([
    candidateRepo.findByEmail(email, tenantId),
    applicationRepo.findByCandidateEmail(email, tenantId),
    interviewRepo.listForCandidate(email, tenantId),
    offerRepo.listForCandidate(email, tenantId),
    consentRepo.historyFor(tenantId, email),
  ]);

  const payload = buildCandidateExport({
    email,
    generatedAt: now.toISOString(),
    profile: profile
      ? { firstName: profile.firstName, lastName: profile.lastName, email: profile.email, phone: profile.phone, location: profile.location, headline: profile.headline, bio: profile.bio, linkedinUrl: profile.linkedinUrl, createdAt: profile.createdAt.toISOString() }
      : null,
    applications: applications.map((a) => ({ id: a.id, status: a.status, submittedAt: a.submittedAt.toISOString(), updatedAt: a.updatedAt.toISOString(), jobTitle: a.job?.title, jobDepartment: a.job?.department, jobLocation: a.job?.location })),
    interviews: interviews.map((i) => ({ id: i.id, status: i.status, type: i.type, round: i.round, scheduledAt: i.scheduledAt.toISOString(), durationMins: i.durationMins, timezone: i.timezone, jobTitle: i.application?.job?.title })),
    offers: offers.map((o) => ({ id: o.id, status: effectiveStatus({ status: o.status, expiresAt: o.expiresAt }, now), salaryAmount: o.salaryAmount, salaryCurrency: o.salaryCurrency, salaryPeriod: o.salaryPeriod, startDate: o.startDate ? o.startDate.toISOString() : null, expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null, terms: o.terms, jobTitle: o.application?.job?.title })),
    consents: consents.map((c) => ({ type: c.type, policyVersion: c.policyVersion, granted: c.granted, source: c.source, createdAt: c.createdAt.toISOString() })),
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${now.toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
