#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# prisma-regen.sh — Regenerate Prisma client + bust TS caches
#
# Usage:  ./scripts/prisma-regen.sh
#         pnpm regen          (if you add the shortcut below)
#
# What it does:
#   1. Pushes schema changes to DB (non-destructive)
#   2. Regenerates Prisma client types
#   3. Clears all TS / Next.js caches that hold stale types
#   4. Touches tsconfigs to force TS server reload in VS Code
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="$ROOT/packages/database"

echo "🔄 [1/5] Pushing schema to DB..."
cd "$DB_DIR"
npx prisma db push --skip-generate 2>&1 | grep -E "sync|error|Error" || true

echo "🔄 [2/5] Regenerating Prisma client..."
npx prisma generate 2>&1 | grep -E "Generated|error|Error"

echo "🧹 [3/5] Clearing stale caches..."
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true
rm -rf "$ROOT/apps/admin/.next" 2>/dev/null || true
rm -rf "$ROOT/apps/web/.next" 2>/dev/null || true
# Clear TS server cache (tsserver stores compiled types here)
rm -rf "$ROOT/node_modules/.cache/typescript" 2>/dev/null || true

echo "📝 [4/5] Touching tsconfigs to force TS server reload..."
find "$ROOT" -maxdepth 3 -name "tsconfig.json" -not -path "*/node_modules/*" -exec touch {} \;

echo "🏗️  [5/5] Verifying build..."
cd "$ROOT"
npx turbo build --filter=admin --force 2>&1 | tail -5

echo ""
echo "✅ Done! Prisma types regenerated and caches cleared."
echo "   If VS Code still shows red squiggles, press Cmd+Shift+P → 'TypeScript: Restart TS Server'"
