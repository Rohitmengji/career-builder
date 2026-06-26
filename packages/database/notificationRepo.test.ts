/*
 * Unit tests for notificationRepo — in-app notifications for both recruiters and candidates
 * (Prisma mocked via ./client).
 *
 * WHY: A notification's recipient is polymorphic — either a `user` (recruiter id) or a
 * `candidate` (identified by email, no FK — ADR-0001). Candidate emails must be lowercased
 * on write AND on every lookup so a recipient sees their own notifications and only their own.
 * These tests pin that normalization and the recipient+tenant scoping.
 *
 * Key behaviors asserted:
 *   - create lowercases a candidate recipientId (email) but leaves a user id case-intact.
 *   - listForRecipient is scoped by tenant + recipientType + normalized recipientId, newest
 *     first, and caps `take` (a caller asking for 999 is clamped to 30).
 *   - countUnread / markAllRead / markRead are recipient-scoped (and markRead also id-scoped),
 *     so one recipient can never read or clear another's notifications.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const createMany = vi.fn();
const findMany = vi.fn();
const count = vi.fn();
const updateMany = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    notification: {
      create: (...a: unknown[]) => create(...a),
      createMany: (...a: unknown[]) => createMany(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

import { notificationRepo } from "./repositories/notificationRepo";

beforeEach(() => {
  [create, createMany, findMany, count, updateMany].forEach((f) => f.mockReset());
});

describe("notificationRepo.create", () => {
  it("lowercases a candidate recipientId (email) but leaves a user id untouched", async () => {
    create.mockResolvedValue({});
    await notificationRepo.create({ tenantId: "acme", recipientType: "candidate", recipientId: "Jane@Example.com", type: "offer_extended", title: "Offer" });
    expect(create.mock.calls[0][0].data).toMatchObject({ recipientType: "candidate", recipientId: "jane@example.com" });

    create.mockResolvedValue({});
    await notificationRepo.create({ tenantId: "acme", recipientType: "user", recipientId: "User_ABC", type: "x", title: "y" });
    expect(create.mock.calls[1][0].data).toMatchObject({ recipientType: "user", recipientId: "User_ABC" });
  });
});

describe("notificationRepo — recipient + tenant scoping", () => {
  it("listForRecipient scopes by tenant + recipientType + (normalized) recipientId and caps the take", async () => {
    findMany.mockResolvedValueOnce([]);
    await notificationRepo.listForRecipient("acme", "candidate", "Jane@Example.com", 999);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: "acme", recipientType: "candidate", recipientId: "jane@example.com" });
    expect(arg.take).toBe(30); // capped
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("countUnread scopes by recipient + readAt null", async () => {
    count.mockResolvedValueOnce(3);
    const n = await notificationRepo.countUnread("acme", "user", "u1");
    expect(count.mock.calls[0][0].where).toEqual({ tenantId: "acme", recipientType: "user", recipientId: "u1", readAt: null });
    expect(n).toBe(3);
  });
});

describe("notificationRepo — mark read", () => {
  it("markAllRead only touches this recipient's unread rows", async () => {
    updateMany.mockResolvedValueOnce({ count: 2 });
    const now = new Date("2026-06-22T00:00:00Z");
    const n = await notificationRepo.markAllRead("acme", "candidate", "JANE@example.com", now);
    expect(updateMany.mock.calls[0][0]).toEqual({
      where: { tenantId: "acme", recipientType: "candidate", recipientId: "jane@example.com", readAt: null },
      data: { readAt: now },
    });
    expect(n).toBe(2);
  });

  it("markRead is scoped by id + recipient (can't read another recipient's notification)", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    const now = new Date("2026-06-22T00:00:00Z");
    await notificationRepo.markRead("n1", "acme", "user", "u1", now);
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: "n1", tenantId: "acme", recipientType: "user", recipientId: "u1", readAt: null });
  });
});
