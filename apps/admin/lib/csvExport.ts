/*
 * CSV export helpers (pure). RFC-4180 quoting + a CSV/formula-injection guard
 * so a candidate-controlled field (name, email) can't execute as a spreadsheet
 * formula when the export is opened in Excel/Sheets.
 */

/** Quote/escape one field; neutralize leading formula characters. */
export function csvField(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Formula-injection guard: a leading = + - @ (or tab/CR) can execute in Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // RFC-4180 quoting when the field contains a delimiter, quote, or newline.
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV string from headers + rows (CRLF line endings per RFC-4180). */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvField).join(",")];
  for (const row of rows) lines.push(row.map(csvField).join(","));
  return lines.join("\r\n");
}

export interface ExportableApplication {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  rating: number | null;
  submittedAt: string | Date;
  job?: { title?: string | null; department?: string | null } | null;
}

/** Tenant-scoped applications → CSV. Caller must pass already-tenant-filtered rows. */
export function applicationsToCsv(apps: ExportableApplication[]): string {
  const headers = ["First name", "Last name", "Email", "Phone", "Job", "Department", "Status", "Rating", "Applied"];
  const rows = apps.map((a) => [
    a.firstName,
    a.lastName,
    a.email,
    a.phone ?? "",
    a.job?.title ?? "",
    a.job?.department ?? "",
    a.status,
    a.rating ?? "",
    a.submittedAt instanceof Date ? a.submittedAt.toISOString() : String(a.submittedAt),
  ]);
  return toCsv(headers, rows);
}
