import { describe, it, expect } from "vitest";
import {
  OFFER_STATUSES,
  canTransition,
  nextStates,
  isTerminal,
  isExpired,
  effectiveStatus,
  isReadyForApproval,
  isOfferStatus,
  offerStatusLabel,
  ACTION_TARGET,
  type OfferStatus,
  type OfferAction,
} from "./offer";

describe("OFFER_STATUSES", () => {
  it("has the 8 statuses in lifecycle order", () => {
    expect(OFFER_STATUSES).toEqual([
      "draft",
      "pending_approval",
      "approved",
      "sent",
      "accepted",
      "declined",
      "expired",
      "rescinded",
    ]);
  });
});

describe("canTransition", () => {
  const allowed: [OfferStatus, OfferStatus][] = [
    ["draft", "pending_approval"],
    ["draft", "rescinded"],
    ["pending_approval", "approved"],
    ["pending_approval", "draft"],
    ["pending_approval", "rescinded"],
    ["approved", "sent"],
    ["approved", "draft"],
    ["approved", "rescinded"],
    ["sent", "accepted"],
    ["sent", "declined"],
    ["sent", "expired"],
    ["sent", "rescinded"],
  ];
  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  const denied: [OfferStatus, OfferStatus][] = [
    ["draft", "approved"], // can't skip approval
    ["draft", "sent"], // can't send unapproved
    ["pending_approval", "sent"], // must pass approved
    ["approved", "accepted"], // candidate can't accept an unsent offer
    ["sent", "approved"], // can't go backwards
    ["accepted", "declined"], // terminal
    ["declined", "sent"], // terminal
    ["expired", "sent"], // terminal
    ["rescinded", "draft"], // terminal
    ["sent", "sent"], // no self-loop
  ];
  it.each(denied)("denies %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("there is NO path to sent that skips approved", () => {
    // Only `approved` may transition to `sent`.
    const sources = OFFER_STATUSES.filter((s) => canTransition(s, "sent"));
    expect(sources).toEqual(["approved"]);
  });
});

describe("isTerminal", () => {
  it("marks the four terminal states", () => {
    expect(isTerminal("accepted")).toBe(true);
    expect(isTerminal("declined")).toBe(true);
    expect(isTerminal("expired")).toBe(true);
    expect(isTerminal("rescinded")).toBe(true);
  });
  it("active states are not terminal", () => {
    for (const s of ["draft", "pending_approval", "approved", "sent"] as OfferStatus[]) {
      expect(isTerminal(s)).toBe(false);
      expect(nextStates(s).length).toBeGreaterThan(0);
    }
  });
});

describe("ACTION_TARGET", () => {
  it("maps every action to a status and the target is reachable from the expected source", () => {
    const actions: OfferAction[] = [
      "submit_for_approval",
      "approve",
      "request_changes",
      "send",
      "accept",
      "decline",
      "expire",
      "rescind",
    ];
    for (const a of actions) expect(isOfferStatus(ACTION_TARGET[a])).toBe(true);
    // Spot-check the load-bearing ones from their natural source.
    expect(canTransition("approved", ACTION_TARGET.send)).toBe(true);
    expect(canTransition("sent", ACTION_TARGET.accept)).toBe(true);
    expect(canTransition("pending_approval", ACTION_TARGET.approve)).toBe(true);
  });
});

describe("isExpired", () => {
  const exp = new Date("2026-07-01T00:00:00Z");
  it("is false at the exact deadline (still acceptable)", () => {
    expect(isExpired({ status: "sent", expiresAt: exp }, new Date(exp))).toBe(false);
  });
  it("is true strictly after the deadline", () => {
    expect(isExpired({ status: "sent", expiresAt: exp }, new Date(exp.getTime() + 1))).toBe(true);
  });
  it("never expires when expiresAt is null", () => {
    expect(isExpired({ status: "sent", expiresAt: null }, new Date())).toBe(false);
  });
  it("only a sent offer can expire by time", () => {
    expect(isExpired({ status: "accepted", expiresAt: exp }, new Date(exp.getTime() + 10_000))).toBe(false);
    expect(isExpired({ status: "draft", expiresAt: exp }, new Date(exp.getTime() + 10_000))).toBe(false);
  });
  it("accepts an ISO-string expiresAt", () => {
    expect(isExpired({ status: "sent", expiresAt: exp.toISOString() }, new Date(exp.getTime() + 1))).toBe(true);
  });
});

describe("effectiveStatus", () => {
  it("collapses an un-swept past-expiry sent offer to expired", () => {
    const exp = new Date("2026-07-01T00:00:00Z");
    expect(effectiveStatus({ status: "sent", expiresAt: exp }, new Date(exp.getTime() + 1))).toBe("expired");
  });
  it("returns the stored status otherwise", () => {
    expect(effectiveStatus({ status: "accepted", expiresAt: null }, new Date())).toBe("accepted");
    expect(effectiveStatus({ status: "sent", expiresAt: null }, new Date())).toBe("sent");
  });
});

describe("isReadyForApproval", () => {
  it("requires a positive amount, 3-letter uppercase currency, valid period", () => {
    expect(isReadyForApproval({ salaryAmount: 145000, salaryCurrency: "USD", salaryPeriod: "yearly" })).toBe(true);
  });
  it("rejects bad inputs", () => {
    expect(isReadyForApproval({ salaryAmount: null, salaryCurrency: "USD", salaryPeriod: "yearly" })).toBe(false);
    expect(isReadyForApproval({ salaryAmount: 0, salaryCurrency: "USD", salaryPeriod: "yearly" })).toBe(false);
    expect(isReadyForApproval({ salaryAmount: -5, salaryCurrency: "USD", salaryPeriod: "yearly" })).toBe(false);
    expect(isReadyForApproval({ salaryAmount: 100, salaryCurrency: "US", salaryPeriod: "yearly" })).toBe(false);
    expect(isReadyForApproval({ salaryAmount: 100, salaryCurrency: "usd", salaryPeriod: "yearly" })).toBe(false);
    expect(isReadyForApproval({ salaryAmount: 100, salaryCurrency: "USD", salaryPeriod: "weekly" })).toBe(false);
  });
});

describe("isOfferStatus / offerStatusLabel", () => {
  it("validates the enum", () => {
    expect(isOfferStatus("sent")).toBe(true);
    expect(isOfferStatus("nope")).toBe(false);
    expect(isOfferStatus(3)).toBe(false);
  });
  it("humanizes labels", () => {
    expect(offerStatusLabel("pending_approval")).toBe("Pending approval");
    expect(offerStatusLabel("sent")).toBe("Sent");
  });
});
