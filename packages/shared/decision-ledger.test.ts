/*
 * Tests for shared/decision-ledger — the composer + tamper-evident seal.
 * Pinned invariants:
 *  - fixed deterministic compose order (screening → statuses → reason);
 *  - a clean recompose VERIFIES against its own seal (the byte-identity contract);
 *  - any change to a sealed field (status seq / screening / reason category / message)
 *    flips the verdict to "modified";
 *  - missing digest → "unsealed".
 */

import { describe, it, expect } from "vitest";
import { composeLedger, canonicalize, seal, verify, entriesFromRaw, type LedgerInput, type RawLedgerData } from "./decision-ledger";

const base: LedgerInput = {
  statuses: ["applied", "screening", "interview", "rejected"],
  screening: { passed: true },
  reason: { category: "experience_gap", message: "We moved forward with candidates who had more direct experience." },
};

describe("composeLedger", () => {
  it("composes in the fixed order screening → statuses → reason", () => {
    const e = composeLedger(base);
    expect(e.map((x) => x.kind)).toEqual(["screening", "status", "status", "status", "status", "reason"]);
  });
  it("omits screening/reason when absent", () => {
    const e = composeLedger({ statuses: ["applied", "hired"] });
    expect(e.map((x) => x.kind)).toEqual(["status", "status"]);
  });
});

describe("seal + verify — byte-identity + tamper detection", () => {
  it("a clean recompose VERIFIES against its own seal", () => {
    const digest = seal(composeLedger(base));
    expect(verify(composeLedger(base), digest)).toBe("verified");
  });

  it("editing the reason CATEGORY → modified", () => {
    const digest = seal(composeLedger(base));
    const tampered = composeLedger({ ...base, reason: { category: "role_filled", message: base.reason!.message } });
    expect(verify(tampered, digest)).toBe("modified");
  });

  it("editing the curated MESSAGE → modified", () => {
    const digest = seal(composeLedger(base));
    const tampered = composeLedger({ ...base, reason: { category: "experience_gap", message: "different wording" } });
    expect(verify(tampered, digest)).toBe("modified");
  });

  it("changing the status sequence → modified", () => {
    const digest = seal(composeLedger(base));
    const tampered = composeLedger({ ...base, statuses: ["applied", "screening", "interview", "hired"] });
    expect(verify(tampered, digest)).toBe("modified");
  });

  it("flipping screening pass/fail → modified", () => {
    const digest = seal(composeLedger(base));
    const tampered = composeLedger({ ...base, screening: { passed: false } });
    expect(verify(tampered, digest)).toBe("modified");
  });

  it("no stored digest → unsealed", () => {
    expect(verify(composeLedger(base), null)).toBe("unsealed");
    expect(verify(composeLedger(base), undefined)).toBe("unsealed");
  });

  it("BYTE-IDENTITY: writer seal == reader recompute via entriesFromRaw (the integrity contract)", () => {
    const raw: RawLedgerData = {
      statuses: ["applied", "screening", "rejected"],
      screeningPassed: true,
      adverse: { category: "experience_gap", candidateMessage: "More direct experience was needed.", sharedWithCandidate: true },
    };
    // Writer (admin, at decision) and reader (web, on view) both run entriesFromRaw.
    const writerDigest = seal(entriesFromRaw(raw));
    const readerVerdict = verify(entriesFromRaw(raw), writerDigest);
    expect(readerVerdict).toBe("verified");
  });

  it("entriesFromRaw OMITS the reason unless sharedWithCandidate (never leaks an unshared reason)", () => {
    const notShared: RawLedgerData = {
      statuses: ["applied", "rejected"],
      screeningPassed: null,
      adverse: { category: "experience_gap", candidateMessage: "internal-only note", sharedWithCandidate: false },
    };
    const entries = entriesFromRaw(notShared);
    expect(entries.some((e) => e.kind === "reason")).toBe(false);
    // and editing the (unshared) reason does NOT change the seal — it isn't in it
    const d1 = seal(entriesFromRaw(notShared));
    const d2 = seal(entriesFromRaw({ ...notShared, adverse: { ...notShared.adverse!, candidateMessage: "changed" } }));
    expect(d1).toBe(d2);
  });

  it("entriesFromRaw maps null screening to no screening entry", () => {
    const e = entriesFromRaw({ statuses: ["applied", "hired"], screeningPassed: null, adverse: null });
    expect(e.every((x) => x.kind !== "screening")).toBe(true);
    expect(e.map((x) => x.kind)).toEqual(["status", "status"]);
  });

  it("canonicalize is stable + excludes anything but the semantic content", () => {
    const c = canonicalize(composeLedger(base));
    expect(c).toContain("Q:1");
    expect(c).toContain("S:applied");
    expect(c).toContain("R:experience_gap|");
    // no timestamps / volatile data in the hashed bytes
    expect(c).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
