/*
 * @career-builder/shared/ics — minimal RFC-5545 calendar (VEVENT) generation.
 *
 * Pure + framework-agnostic so it's unit-testable. Emits a single-event VCALENDAR
 * a candidate can download / "Add to calendar". Times are emitted as UTC
 * (Z-suffixed) — the caller stores UTC; the human-readable timezone lives in the
 * email body, not the ICS.
 */

export interface IcsEvent {
  uid: string;
  start: Date; // UTC instant
  durationMins: number;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  organizerEmail?: string;
  attendeeEmail?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format an instant as an RFC-5545 UTC timestamp: YYYYMMDDTHHMMSSZ. */
export function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape per RFC-5545 §3.3.11 (backslash, semicolon, comma, newline). */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Build a single-event VCALENDAR string (CRLF line endings, as the spec requires).
 * `now` is injectable for deterministic tests (the DTSTAMP).
 */
export function buildIcs(ev: IcsEvent, now: Date = new Date()): string {
  const end = new Date(ev.start.getTime() + Math.max(1, ev.durationMins) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Career Builder//Interview//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(ev.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(ev.title)}`,
    ...(ev.description ? [`DESCRIPTION:${escapeIcsText(ev.description)}`] : []),
    ...(ev.location ? [`LOCATION:${escapeIcsText(ev.location)}`] : []),
    ...(ev.url ? [`URL:${escapeIcsText(ev.url)}`] : []),
    ...(ev.organizerEmail ? [`ORGANIZER:mailto:${ev.organizerEmail}`] : []),
    ...(ev.attendeeEmail ? [`ATTENDEE;RSVP=TRUE:mailto:${ev.attendeeEmail}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
