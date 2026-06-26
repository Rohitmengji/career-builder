/*
 * Unit (contract) tests for campaignRepo (ADR-0019, B4). Prisma is mocked.
 * Pinned invariants: tenant scoping everywhere; recordSend + enroll are idempotent
 * (P2002 → false) so the cron dispatch can't double-send; addStep appends at the next
 * index; deleteEnrollmentsByEmail (erasure hook) scopes by tenant + lc email.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const campaignFindMany = vi.fn();
const campaignFindFirst = vi.fn();
const campaignCreate = vi.fn();
const campaignUpdateMany = vi.fn();
const campaignDeleteMany = vi.fn();
const stepFindMany = vi.fn();
const stepFindFirst = vi.fn();
const stepCreate = vi.fn();
const enrollCreate = vi.fn();
const enrollFindMany = vi.fn();
const enrollDeleteMany = vi.fn();
const sendCreate = vi.fn();

vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c; } }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock("./client", () => ({
  prisma: {
    emailCampaign: { findMany: (...a: unknown[]) => campaignFindMany(...a), findFirst: (...a: unknown[]) => campaignFindFirst(...a), create: (...a: unknown[]) => campaignCreate(...a), updateMany: (...a: unknown[]) => campaignUpdateMany(...a), deleteMany: (...a: unknown[]) => campaignDeleteMany(...a) },
    campaignStep: { findMany: (...a: unknown[]) => stepFindMany(...a), findFirst: (...a: unknown[]) => stepFindFirst(...a), create: (...a: unknown[]) => stepCreate(...a) },
    campaignEnrollment: { create: (...a: unknown[]) => enrollCreate(...a), findMany: (...a: unknown[]) => enrollFindMany(...a), deleteMany: (...a: unknown[]) => enrollDeleteMany(...a) },
    campaignSend: { create: (...a: unknown[]) => sendCreate(...a) },
  },
}));

import { Prisma } from "@prisma/client";
import { campaignRepo } from "./repositories/campaignRepo";

beforeEach(() => { [campaignFindMany, campaignFindFirst, campaignCreate, campaignUpdateMany, campaignDeleteMany, stepFindMany, stepFindFirst, stepCreate, enrollCreate, enrollFindMany, enrollDeleteMany, sendCreate].forEach((f) => f.mockReset()); });

describe("campaignRepo — scoping", () => {
  it("findByIdScoped + listSteps + listEnrollments are tenant-scoped", async () => {
    campaignFindFirst.mockResolvedValueOnce(null); stepFindMany.mockResolvedValueOnce([]); enrollFindMany.mockResolvedValueOnce([]);
    await campaignRepo.findByIdScoped("c1", "acme");
    await campaignRepo.listSteps("acme", "c1");
    await campaignRepo.listEnrollments("acme", "c1");
    expect(campaignFindFirst.mock.calls[0][0].where).toEqual({ id: "c1", tenantId: "acme" });
    expect(stepFindMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", campaignId: "c1" });
    expect(enrollFindMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", campaignId: "c1" });
  });

  it("update + delete are tenant-scoped", async () => {
    campaignUpdateMany.mockResolvedValueOnce({ count: 1 }); campaignDeleteMany.mockResolvedValueOnce({ count: 1 });
    await campaignRepo.update("c1", "acme", { status: "active" });
    await campaignRepo.delete("c1", "acme");
    expect(campaignUpdateMany.mock.calls[0][0].where).toEqual({ id: "c1", tenantId: "acme" });
    expect(campaignDeleteMany.mock.calls[0][0].where).toEqual({ id: "c1", tenantId: "acme" });
  });
});

describe("campaignRepo — steps", () => {
  it("addStep appends at next index (last+1)", async () => {
    stepFindFirst.mockResolvedValueOnce({ stepIndex: 2 });
    stepCreate.mockResolvedValueOnce({});
    await campaignRepo.addStep("acme", "c1", { offsetDays: 7, subject: "Hi", body: "Body" });
    expect(stepCreate.mock.calls[0][0].data).toMatchObject({ tenantId: "acme", campaignId: "c1", stepIndex: 3, offsetDays: 7 });
  });
  it("addStep starts at 0 when no steps exist", async () => {
    stepFindFirst.mockResolvedValueOnce(null);
    stepCreate.mockResolvedValueOnce({});
    await campaignRepo.addStep("acme", "c1", { offsetDays: 0, subject: "S", body: "B" });
    expect(stepCreate.mock.calls[0][0].data.stepIndex).toBe(0);
  });
});

describe("campaignRepo — idempotency", () => {
  it("enroll lowercases email + returns true; P2002 → false", async () => {
    enrollCreate.mockResolvedValueOnce({});
    expect(await campaignRepo.enroll("acme", "c1", "JANE@X.com", "Jane")).toBe(true);
    expect(enrollCreate.mock.calls[0][0].data).toMatchObject({ tenantId: "acme", campaignId: "c1", candidateEmail: "jane@x.com", candidateName: "Jane" });
    enrollCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", "P2002"));
    expect(await campaignRepo.enroll("acme", "c1", "a@x.com")).toBe(false);
  });

  it("recordSend returns true on create, false on P2002 (dedupe → no double-send)", async () => {
    sendCreate.mockResolvedValueOnce({});
    expect(await campaignRepo.recordSend("acme", "c1", "e1", 0, "A@X.com")).toBe(true);
    expect(sendCreate.mock.calls[0][0].data).toMatchObject({ tenantId: "acme", campaignId: "c1", enrollmentId: "e1", stepIndex: 0, candidateEmail: "a@x.com" });
    sendCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", "P2002"));
    expect(await campaignRepo.recordSend("acme", "c1", "e1", 0, "a@x.com")).toBe(false);
  });
});

describe("campaignRepo — erasure hook", () => {
  it("deleteEnrollmentsByEmail scopes by tenant + lc email", async () => {
    enrollDeleteMany.mockResolvedValueOnce({ count: 2 });
    await campaignRepo.deleteEnrollmentsByEmail("acme", "JANE@X.com");
    expect(enrollDeleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", candidateEmail: "jane@x.com" });
  });
});
