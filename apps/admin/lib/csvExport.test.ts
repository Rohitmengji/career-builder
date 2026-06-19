import { describe, it, expect } from "vitest";
import { csvField, toCsv, applicationsToCsv } from "./csvExport";

describe("csvField", () => {
  it("quotes fields containing comma, quote, or newline", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes formula-injection (Excel) leading chars", () => {
    expect(csvField("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-2")).toBe("'-2");
    expect(csvField("@cmd")).toBe("'@cmd");
  });

  it("guards a dangerous value that ALSO needs quoting", () => {
    // leading '=' is prefixed, and the comma still forces quoting
    expect(csvField("=1,2")).toBe(`"'=1,2"`);
  });

  it("renders empty for null/undefined", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("emits header + rows with CRLF", () => {
    const csv = toCsv(["A", "B"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("A,B\r\n1,2\r\n3,4");
  });
});

describe("applicationsToCsv", () => {
  it("includes the expected columns and escapes candidate-controlled fields", () => {
    const csv = applicationsToCsv([
      {
        firstName: "=cmd",
        lastName: "Doe",
        email: "jane@x.com",
        phone: null,
        status: "applied",
        rating: 4,
        submittedAt: "2026-01-01T00:00:00.000Z",
        job: { title: "Eng, Senior", department: "R&D" },
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("First name");
    expect(row).toContain("'=cmd"); // formula-injection neutralized
    expect(row).toContain('"Eng, Senior"'); // comma quoted
  });
});
