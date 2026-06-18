#!/usr/bin/env tsx
/*
 * CI parity guard: fail if prisma/turso-schema.sql has drifted from schema.prisma.
 *
 * The committed turso-schema.sql is a GENERATED artifact (see db:gen-turso-sql).
 * This script regenerates it in-memory and compares. If they differ, someone
 * changed schema.prisma without regenerating the Turso DDL — which is exactly
 * the failure mode that previously caused a production outage.
 *
 * Usage:  cd packages/database && npx tsx verify-turso-schema.ts
 */

import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "prisma", "turso-schema.sql");

// Normalize: strip our header comment block + collapse whitespace so the
// comparison is about SQL semantics, not formatting.
function normalize(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  let committed: string;
  try {
    committed = readFileSync(sqlPath, "utf8");
  } catch {
    console.error(`❌ ${sqlPath} is missing. Run: npm run db:gen-turso-sql`);
    process.exit(1);
  }

  const fresh = execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    { cwd: __dirname, encoding: "utf8" }
  );

  if (normalize(committed) !== normalize(fresh)) {
    console.error(
      "❌ prisma/turso-schema.sql is OUT OF DATE with schema.prisma.\n" +
        "   Run `npm run db:gen-turso-sql` (in packages/database) and commit the result."
    );
    process.exit(1);
  }

  console.log("✅ Turso DDL is in sync with schema.prisma.");
}

main();
