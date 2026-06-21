import { describe, it, expect } from "vitest";
import { buildIcs, toIcsUtc, escapeIcsText } from "./ics";

const NOW = new Date("2026-06-21T09:00:00Z");
const START = new Date("2026-06-25T14:30:00Z");

describe("toIcsUtc", () => {
  it("formats an instant as YYYYMMDDTHHMMSSZ in UTC", () => {
    expect(toIcsUtc(START)).toBe("20260625T143000Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma, and newlines", () => {
    expect(escapeIcsText("a; b, c\\d\ne")).toBe("a\\; b\\, c\\\\d\\ne");
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(
    {
      uid: "int_123@careerbuilder",
      start: START,
      durationMins: 45,
      title: "Interview: Senior Engineer",
      description: "Video call; bring questions",
      url: "https://meet.example.com/abc",
      organizerEmail: "jobs@acme.com",
      attendeeEmail: "jane@example.com",
    },
    NOW,
  );

  it("wraps a single VEVENT in a VCALENDAR with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.includes("\n") && ics.includes("\r\n")).toBe(true);
  });

  it("emits UID, UTC DTSTAMP/DTSTART, and a DTEND = start + duration", () => {
    expect(ics).toContain("UID:int_123@careerbuilder");
    expect(ics).toContain("DTSTAMP:20260621T090000Z");
    expect(ics).toContain("DTSTART:20260625T143000Z");
    expect(ics).toContain("DTEND:20260625T151500Z"); // +45m
  });

  it("escapes text fields and includes optional url/organizer/attendee", () => {
    expect(ics).toContain("SUMMARY:Interview: Senior Engineer");
    expect(ics).toContain("DESCRIPTION:Video call\\; bring questions");
    expect(ics).toContain("URL:https://meet.example.com/abc");
    expect(ics).toContain("ORGANIZER:mailto:jobs@acme.com");
    expect(ics).toContain("ATTENDEE;RSVP=TRUE:mailto:jane@example.com");
  });

  it("omits optional lines when not provided + clamps zero duration", () => {
    const minimal = buildIcs({ uid: "u", start: START, durationMins: 0, title: "Chat" }, NOW);
    expect(minimal).not.toContain("DESCRIPTION:");
    expect(minimal).not.toContain("LOCATION:");
    expect(minimal).not.toContain("ATTENDEE");
    expect(minimal).toContain("DTEND:20260625T143100Z"); // duration clamped to >= 1 min
  });
});
