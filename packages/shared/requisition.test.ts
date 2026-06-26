/*
 * Tests for shared/requisition — the requisition state machine (ADR-0020).
 * Pinned invariants: approval is reachable ONLY via pending_approval; `approved`
 * is terminal; allowsPublish is true ONLY for approved (the job-publish gate).
 */

import { describe, it, expect } from "vitest";
import {
  REQUISITION_STATUSES,
  isRequisitionStatus,
  isTerminal,
  canTransition,
  nextStates,
  targetFor,
  allowsPublish,
} from "./requisition";

describe("requisition state machine", () => {
  it("draft → pending_approval → approved is the only path to approved", () => {
    expect(canTransition("draft", "pending_approval")).toBe(true);
    expect(canTransition("pending_approval", "approved")).toBe(true);
    // No shortcut straight to approved:
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
  });

  it("approved is terminal (no outbound transitions)", () => {
    expect(isTerminal("approved")).toBe(true);
    expect(nextStates("approved")).toEqual([]);
  });

  it("rejected can be reworked back to draft", () => {
    expect(canTransition("rejected", "draft")).toBe(true);
    expect(canTransition("pending_approval", "rejected")).toBe(true);
  });

  it("allowsPublish is true ONLY for approved", () => {
    expect(allowsPublish("approved")).toBe(true);
    for (const s of ["draft", "pending_approval", "rejected"] as const) {
      expect(allowsPublish(s)).toBe(false);
    }
    expect(allowsPublish(null)).toBe(false);
    expect(allowsPublish(undefined)).toBe(false);
  });

  it("actions map to the right target status", () => {
    expect(targetFor("submit")).toBe("pending_approval");
    expect(targetFor("approve")).toBe("approved");
    expect(targetFor("reject")).toBe("rejected");
    expect(targetFor("reopen")).toBe("draft");
  });

  it("isRequisitionStatus guards the union; STATUSES has all four", () => {
    expect(REQUISITION_STATUSES).toHaveLength(4);
    expect(isRequisitionStatus("approved")).toBe(true);
    expect(isRequisitionStatus("sent")).toBe(false);
    expect(isRequisitionStatus(42)).toBe(false);
  });
});
