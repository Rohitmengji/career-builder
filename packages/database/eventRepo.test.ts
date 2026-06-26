/*
 * Unit (contract) tests for eventRepo — the application-event timeline. Prisma
 * is mocked (./client), so these assert the query shape + projection the repo
 * builds, not DB behavior.
 *
 * WHY: events carry an internal/candidate visibility split and free-form
 * metadata. The candidate-facing read must leak nothing identifying, and writes
 * must default safely (system actor, internal visibility).
 *
 * Key behaviors pinned:
 *   - record() stores a tenant-scoped row with metadata JSON-stringified;
 *     defaults actorType=system, visibility=internal, and nulls optional fields.
 *   - listCandidateVisible scopes to tenantId + visibility:"candidate" + the
 *     candidate's OWN app ids, short-circuits to [] (no DB hit) on empty input,
 *     and projects to ONLY {applicationId, type, toStatus, createdAt→at} —
 *     never actorId/metadata/visibility.
 *   - listStatusChanges filters tenant + type:"status_change", projects to a
 *     narrow shape, and respects the `take` cap.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client before importing the repo (hoisted).
const create = vi.fn();
const findMany = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    applicationEvent: {
      create: (...a: unknown[]) => create(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));

import { eventRepo } from "./repositories/eventRepo";

beforeEach(() => {
  create.mockReset();
  findMany.mockReset();
});

describe("eventRepo.record", () => {
  it("stores a tenant-scoped event with JSON-stringified metadata", async () => {
    create.mockResolvedValueOnce({ id: "e1" });
    await eventRepo.record({
      tenantId: "acme",
      applicationId: "app1",
      type: "status_change",
      fromStatus: "applied",
      toStatus: "screening",
      actorId: "u1",
      actorType: "recruiter",
      visibility: "candidate",
      metadata: { round: 1 },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: "acme",
        applicationId: "app1",
        type: "status_change",
        fromStatus: "applied",
        toStatus: "screening",
        actorId: "u1",
        actorType: "recruiter",
        visibility: "candidate",
        metadata: JSON.stringify({ round: 1 }),
      },
    });
  });

  it("defaults actorType=system, visibility=internal, nulls for optional fields", async () => {
    create.mockResolvedValueOnce({});
    await eventRepo.record({ tenantId: "acme", applicationId: "app1", type: "offer_expired" });
    const data = create.mock.calls[0][0].data;
    expect(data.actorType).toBe("system");
    expect(data.visibility).toBe("internal");
    expect(data.metadata).toBeNull();
    expect(data.fromStatus).toBeNull();
    expect(data.toStatus).toBeNull();
    expect(data.actorId).toBeNull();
  });
});

describe("eventRepo.listCandidateVisible — isolation + projection", () => {
  it("returns [] with NO DB hit when the candidate has no applications", async () => {
    const res = await eventRepo.listCandidateVisible("acme", []);
    expect(res).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("scopes to tenant + candidate visibility + the given app ids, and projects to safe fields only", async () => {
    findMany.mockResolvedValueOnce([
      { applicationId: "app1", type: "status_change", toStatus: "interview", createdAt: new Date("2026-01-02") },
    ]);
    const res = await eventRepo.listCandidateVisible("acme", ["app1", "app2"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "acme", applicationId: { in: ["app1", "app2"] }, visibility: "candidate" },
        select: { applicationId: true, type: true, toStatus: true, createdAt: true },
      }),
    );
    // The projection must expose ONLY non-identifying fields — never actorId/metadata/visibility.
    expect(res).toEqual([{ applicationId: "app1", type: "status_change", toStatus: "interview", at: new Date("2026-01-02") }]);
    expect(Object.keys(res[0]).sort()).toEqual(["applicationId", "at", "toStatus", "type"]);
  });
});

describe("eventRepo.listStatusChanges", () => {
  it("filters to status_change for the tenant, projected + capped", async () => {
    findMany.mockResolvedValueOnce([]);
    await eventRepo.listStatusChanges("acme", 500);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: "acme", type: "status_change" });
    expect(arg.take).toBe(500);
    expect(arg.select).toEqual({ applicationId: true, toStatus: true, createdAt: true });
  });
});
