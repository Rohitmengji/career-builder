import { describe, it, expect, vi, beforeEach } from "vitest";

const appFindMany = vi.fn();
const appUpdateMany = vi.fn();
const adverseUpdateMany = vi.fn();
const offerUpdateMany = vi.fn();
const notifDeleteMany = vi.fn();
const consentUpdateMany = vi.fn();
const candidateDeleteMany = vi.fn();
const auditCreate = vi.fn();
const consentCreate = vi.fn();
const consentFindMany = vi.fn();

const tx = {
  application: { findMany: (...a: unknown[]) => appFindMany(...a), updateMany: (...a: unknown[]) => appUpdateMany(...a) },
  adverseAction: { updateMany: (...a: unknown[]) => adverseUpdateMany(...a) },
  offer: { updateMany: (...a: unknown[]) => offerUpdateMany(...a) },
  notification: { deleteMany: (...a: unknown[]) => notifDeleteMany(...a) },
  consent: { updateMany: (...a: unknown[]) => consentUpdateMany(...a) },
  candidate: { deleteMany: (...a: unknown[]) => candidateDeleteMany(...a) },
  auditLog: { create: (...a: unknown[]) => auditCreate(...a) },
};

vi.mock("./client", () => ({
  prisma: {
    consent: { create: (...a: unknown[]) => consentCreate(...a), findMany: (...a: unknown[]) => consentFindMany(...a) },
    $transaction: (cb: (t: unknown) => unknown) => cb(tx),
  },
}));

import { dataRightsRepo, anonymizedApplicationData } from "./repositories/dataRightsRepo";
import { consentRepo } from "./repositories/consentRepo";

beforeEach(() => {
  [appFindMany, appUpdateMany, adverseUpdateMany, offerUpdateMany, notifDeleteMany, consentUpdateMany, candidateDeleteMany, auditCreate, consentCreate, consentFindMany].forEach((f) => f.mockReset());
});

const NOW = new Date("2026-06-22T00:00:00Z");

describe("anonymizedApplicationData", () => {
  it("nulls PII, pseudonymizes the email irreversibly, and stamps anonymizedAt", () => {
    const d = anonymizedApplicationData("Jane@Example.com", NOW);
    expect(d.firstName).toBe("Redacted");
    expect(d.phone).toBeNull();
    expect(d.resumeText).toBeNull();
    expect(d.resumeUrl).toBeNull();
    expect(d.resumePath).toBeNull();
    expect(d.anonymizedAt).toBe(NOW);
    expect(d.email).toMatch(/^anon-[0-9a-f]{24}@redacted\.invalid$/);
    expect(d.email).not.toContain("jane");
  });
});

describe("dataRightsRepo.deleteCandidateData", () => {
  it("DEFERS entirely when any application is under legal hold — checked INSIDE the tx", async () => {
    appFindMany.mockResolvedValueOnce([{ id: "a1", legalHold: false, resumePath: null }, { id: "a2", legalHold: true, resumePath: null }]);
    const res = await dataRightsRepo.deleteCandidateData("acme", "jane@example.com", NOW);
    expect(res).toMatchObject({ deferred: true, reason: "legal_hold", candidateDeleted: false, resumeKeys: [] });
    // Nothing erased once a hold is detected.
    expect(appUpdateMany).not.toHaveBeenCalled();
    expect(candidateDeleteMany).not.toHaveBeenCalled();
    expect(offerUpdateMany).not.toHaveBeenCalled();
  });

  it("anonymizes (with legalHold:false guard), strips adverse freeText + offer notes, deletes candidate+notifications, pseudonymizes consent, returns résumé keys", async () => {
    appFindMany.mockResolvedValueOnce([{ id: "a1", legalHold: false, resumePath: "resumes/t/acme/x.pdf" }]);
    appUpdateMany.mockResolvedValueOnce({ count: 1 });
    adverseUpdateMany.mockResolvedValueOnce({ count: 1 });
    offerUpdateMany.mockResolvedValueOnce({ count: 1 });
    notifDeleteMany.mockResolvedValueOnce({ count: 3 });
    consentUpdateMany.mockResolvedValueOnce({ count: 2 });
    candidateDeleteMany.mockResolvedValueOnce({ count: 1 });
    auditCreate.mockResolvedValueOnce({});

    const res = await dataRightsRepo.deleteCandidateData("acme", "JANE@example.com", NOW);

    // in-tx scoping read by tenant + lowercased email
    expect(appFindMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", email: "jane@example.com" });
    // anonymize WHERE carries legalHold:false (authoritative race guard)
    expect(appUpdateMany.mock.calls[0][0].where).toMatchObject({ tenantId: "acme", email: "jane@example.com", legalHold: false, anonymizedAt: null });
    // adverse-action KEPT but BOTH candidateMessage + freeText nulled
    expect(adverseUpdateMany.mock.calls[0][0]).toEqual({ where: { tenantId: "acme", applicationId: { in: ["a1"] } }, data: { candidateMessage: null, freeText: null } });
    // candidate-authored offer note nulled
    expect(offerUpdateMany.mock.calls[0][0]).toEqual({ where: { tenantId: "acme", applicationId: { in: ["a1"] } }, data: { decisionNote: null } });
    // notifications deleted by email key (no FK)
    expect(notifDeleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", recipientType: "candidate", recipientId: "jane@example.com" });
    // consent pseudonymized (kept)
    expect(consentUpdateMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", subjectEmail: "jane@example.com" });
    // candidate hard-deleted
    expect(candidateDeleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", email: "jane@example.com" });
    // PII-free audit (no email)
    expect(JSON.stringify(auditCreate.mock.calls[0][0].data)).not.toContain("jane");

    expect(res).toMatchObject({ deferred: false, applicationsAnonymized: 1, notificationsDeleted: 3, candidateDeleted: true, resumeKeys: ["resumes/t/acme/x.pdf"] });
  });
});

describe("consentRepo", () => {
  it("record lowercases the subject email (append-only create)", async () => {
    consentCreate.mockResolvedValueOnce({});
    await consentRepo.record({ tenantId: "acme", subjectEmail: "Jane@Example.com", type: "privacy_policy", policyVersion: "v1", granted: true, source: "apply" });
    expect(consentCreate.mock.calls[0][0].data).toMatchObject({ subjectEmail: "jane@example.com", granted: true, type: "privacy_policy" });
  });

  it("currentFor returns the latest granted per type", async () => {
    consentFindMany.mockResolvedValueOnce([
      { type: "marketing", granted: false },
      { type: "marketing", granted: true },
      { type: "privacy_policy", granted: true },
    ]);
    const cur = await consentRepo.currentFor("acme", "jane@example.com");
    expect(cur).toEqual({ marketing: false, privacy_policy: true });
  });
});
