/*
 * Pure hostname helpers (no Prisma import) so app + edge code can normalize a
 * host without pulling the database client.
 */

/** Normalize a user-entered host: strip scheme/path/port, lowercase, trim dots. */
export function normalizeHostname(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/\/.*$/, "")
    .split(":")[0]!
    .replace(/\.+$/, "");
}
