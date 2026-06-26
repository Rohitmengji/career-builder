/*
 * Unit tests for the pipeline-stage model (./pipeline) — the bridge between
 * configurable hiring stages and the canonical 6-value application status.
 *
 * WHY: custom stages are being layered on top of the legacy hardcoded
 * applied/screening/interview/offer/hired/rejected statuses. Everything
 * downstream (metrics, responsiveness, blind-hiring) reasons over the canonical
 * status, so this module classifies any stage by its `kind` and collapses it
 * back to a canonical status. These tests are the NO-REGRESSION proof that the
 * new kind-based helpers reproduce today's hardcoded behavior exactly.
 *
 * Key behaviors asserted:
 *  - DEFAULT_STAGES map 1:1 to the 6 legacy statuses, in order, with the right
 *    terminal flags and kinds;
 *  - isPreOffer/isPreHire/isTerminal/isResponded agree with the legacy sets for
 *    every legacy status (table-driven), where only "applied" is not-yet-responded;
 *  - isStageKind validates the kind enum; the synthetic "custom" kind is
 *    mid-funnel (pre-offer/pre-hire, responded, non-terminal);
 *  - statusForStage keeps a default stage's exact key but collapses any custom
 *    stage to its kind's canonical status, and ONLY ever emits a canonical value
 *    (so downstream reasoners never see a non-canonical status).
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAGES,
  STAGE_KINDS,
  LEGACY_STATUS_TO_KIND,
  KIND_DEFAULT_KEY,
  isStageKind,
  isTerminal,
  isResponded,
  isPreOffer,
  isPreHire,
  statusForStage,
  CANONICAL_STATUSES,
  type StageKind,
} from "./pipeline";

// The legacy sets the helpers MUST agree with (today's hardcoded behavior).
const LEGACY_PRE_OFFER = new Set(["applied", "screening", "interview"]);
const LEGACY_PRE_HIRE = new Set(["applied", "screening", "interview", "offer"]);
const LEGACY_TERMINAL = new Set(["hired", "rejected"]);
const LEGACY_STATUSES = ["applied", "screening", "interview", "offer", "hired", "rejected"];

describe("DEFAULT_STAGES", () => {
  it("maps 1:1 to today's 6 statuses, in order", () => {
    expect(DEFAULT_STAGES.map((s) => s.key)).toEqual(LEGACY_STATUSES);
    DEFAULT_STAGES.forEach((s, i) => expect(s.order).toBe(i));
  });
  it("marks hired + rejected terminal, nothing else", () => {
    expect(DEFAULT_STAGES.filter((s) => s.isTerminal).map((s) => s.key)).toEqual(["hired", "rejected"]);
  });
  it("assigns the expected kinds", () => {
    const byKey = Object.fromEntries(DEFAULT_STAGES.map((s) => [s.key, s.kind]));
    expect(byKey).toEqual({
      applied: "applied", screening: "in_process", interview: "in_process",
      offer: "offer", hired: "hired", rejected: "rejected",
    });
  });
});

describe("LEGACY_STATUS_TO_KIND / KIND_DEFAULT_KEY", () => {
  it("covers all 6 legacy statuses", () => {
    expect(Object.keys(LEGACY_STATUS_TO_KIND).sort()).toEqual([...LEGACY_STATUSES].sort());
  });
  it("KIND_DEFAULT_KEY round-trips offer/hired/rejected/applied to their canonical key", () => {
    expect(KIND_DEFAULT_KEY.offer).toBe("offer");
    expect(KIND_DEFAULT_KEY.hired).toBe("hired");
    expect(KIND_DEFAULT_KEY.rejected).toBe("rejected");
    expect(KIND_DEFAULT_KEY.applied).toBe("applied");
  });
});

describe("kind helpers AGREE with today's hardcoded sets (no-regression proof)", () => {
  it.each(LEGACY_STATUSES)("status %s classified identically", (status) => {
    const kind = LEGACY_STATUS_TO_KIND[status] as StageKind;
    expect(isPreOffer(kind)).toBe(LEGACY_PRE_OFFER.has(status));
    expect(isPreHire(kind)).toBe(LEGACY_PRE_HIRE.has(status));
    expect(isTerminal(kind)).toBe(LEGACY_TERMINAL.has(status));
    // responsiveness: only "applied" is not-yet-responded
    expect(isResponded(kind)).toBe(status !== "applied");
  });
});

describe("isStageKind", () => {
  it("validates the kind enum", () => {
    for (const k of STAGE_KINDS) expect(isStageKind(k)).toBe(true);
    expect(isStageKind("nope")).toBe(false);
    expect(isStageKind(5)).toBe(false);
  });
});

describe("custom-stage semantics (no legacy equivalent)", () => {
  it("a custom stage is pre-offer/pre-hire (mid-funnel), responded, not terminal", () => {
    expect(isPreOffer("custom")).toBe(true);
    expect(isPreHire("custom")).toBe(true);
    expect(isResponded("custom")).toBe(true);
    expect(isTerminal("custom")).toBe(false);
  });
});

describe("statusForStage — keeps the canonical 6-value status valid for custom stages", () => {
  it("a default stage keeps its exact key", () => {
    expect(statusForStage({ key: "screening", kind: "in_process" })).toBe("screening");
    expect(statusForStage({ key: "interview", kind: "in_process" })).toBe("interview");
    expect(statusForStage({ key: "offer", kind: "offer" })).toBe("offer");
    expect(statusForStage({ key: "hired", kind: "hired" })).toBe("hired");
    expect(statusForStage({ key: "rejected", kind: "rejected" })).toBe("rejected");
    expect(statusForStage({ key: "applied", kind: "applied" })).toBe("applied");
  });
  it("a custom stage collapses to its kind's canonical status", () => {
    expect(statusForStage({ key: "take_home", kind: "in_process" })).toBe("interview");
    expect(statusForStage({ key: "final_round", kind: "custom" })).toBe("interview");
    expect(statusForStage({ key: "verbal_offer", kind: "offer" })).toBe("offer");
    expect(statusForStage({ key: "talent_pool", kind: "rejected" })).toBe("rejected");
  });
  it("only produces canonical statuses (reasoners never see a non-canonical value)", () => {
    for (const k of STAGE_KINDS) {
      expect(CANONICAL_STATUSES).toContain(statusForStage({ key: "custom_" + k, kind: k }));
    }
  });
});
