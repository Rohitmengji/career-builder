/*
 * Tests for shared/rater-calibration — interviewer leniency/harshness psychometrics.
 * Pinned: deviation is vs the per-application panel mean (controls for candidate
 * quality); min-sample suppression hides thin-data tendencies; labels are correct.
 */

import { describe, it, expect } from "vitest";
import { computeRaterCalibration, MIN_CALIBRATION_SAMPLE, type CalibrationRow } from "./rater-calibration";

// Helper: build rows for N applications each scored by two raters A (lenient) + B (harsh).
function lenientVsHarsh(n: number): CalibrationRow[] {
  const rows: CalibrationRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({ interviewerId: "A", interviewerName: "Ava", applicationId: `app${i}`, score: 4 });
    rows.push({ interviewerId: "B", interviewerName: "Ben", applicationId: `app${i}`, score: 2 });
  }
  return rows;
}

describe("computeRaterCalibration", () => {
  it("detects a consistently lenient vs harsh rater (deviation from panel mean)", () => {
    const res = computeRaterCalibration(lenientVsHarsh(5)); // 5 comparable apps > min sample
    const ava = res.raters.find((r) => r.interviewerId === "A")!;
    const ben = res.raters.find((r) => r.interviewerId === "B")!;
    expect(ava.leniency).toBe(1); // 4 vs app-mean 3 → +1
    expect(ava.label).toBe("lenient");
    expect(ben.leniency).toBe(-1); // 2 vs app-mean 3 → -1
    expect(ben.label).toBe("harsh");
  });

  it("suppresses leniency below the minimum sample (thin data is noise)", () => {
    const res = computeRaterCalibration(lenientVsHarsh(MIN_CALIBRATION_SAMPLE - 1));
    for (const r of res.raters) {
      expect(r.suppressed).toBe(true);
      expect(r.leniency).toBeNull();
      expect(r.label).toBe("insufficient_data");
    }
  });

  it("labels a rater who tracks the panel as balanced", () => {
    // Three raters, varied scores, but rater C always equals the app mean.
    const rows: CalibrationRow[] = [];
    for (let i = 0; i < 4; i++) {
      rows.push({ interviewerId: "A", interviewerName: "A", applicationId: `a${i}`, score: 5 });
      rows.push({ interviewerId: "B", interviewerName: "B", applicationId: `a${i}`, score: 1 });
      rows.push({ interviewerId: "C", interviewerName: "C", applicationId: `a${i}`, score: 3 }); // = mean(5,1,3)=3
    }
    const c = computeRaterCalibration(rows).raters.find((r) => r.interviewerId === "C")!;
    expect(c.leniency).toBe(0);
    expect(c.label).toBe("balanced");
  });

  it("ignores single-rater applications for leniency (no panel to compare to)", () => {
    const rows: CalibrationRow[] = [
      { interviewerId: "A", interviewerName: "A", applicationId: "solo", score: 5 },
    ];
    const res = computeRaterCalibration(rows);
    expect(res.comparableApplications).toBe(0);
    const a = res.raters.find((r) => r.interviewerId === "A")!;
    expect(a.scored).toBe(1);       // still counts toward "scored"
    expect(a.sampleSize).toBe(0);   // but not comparable
    expect(a.suppressed).toBe(true);
  });

  it("computes panel agreement as mean within-app score spread", () => {
    const res = computeRaterCalibration(lenientVsHarsh(3)); // each app spread = |4-2| = 2
    expect(res.panelAgreement).toBe(2);
    expect(res.comparableApplications).toBe(3);
  });

  it("handles empty input", () => {
    const res = computeRaterCalibration([]);
    expect(res.raters).toEqual([]);
    expect(res.panelAgreement).toBeNull();
  });
});
