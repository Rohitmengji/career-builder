#!/bin/bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Push to personal GitHub repo and trigger Vercel deploy
#
# Uses a separate remote URL with explicit credentials so you
# don't need to change your global git config or SSH keys.
#
# Usage:
#   ./scripts/deploy.sh                    # auto commit + push
#   ./scripts/deploy.sh "my commit msg"    # custom commit message
#   ./scripts/deploy.sh --push-only        # push only, no commit
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────
REPO_URL="https://github.com/Rohitmengji/career-builder.git"
BRANCH="main"
REMOTE_NAME="personal"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Navigate to project root ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${CYAN}🚀 Career Builder — Deploy to Personal GitHub${NC}"
echo -e "${CYAN}   Repo: ${REPO_URL}${NC}"
echo ""

# ── Ensure remote exists ─────────────────────────────────────
if ! git remote get-url "$REMOTE_NAME" &>/dev/null; then
  echo -e "${YELLOW}Adding remote '${REMOTE_NAME}'...${NC}"
  git remote add "$REMOTE_NAME" "$REPO_URL"
else
  # Update URL in case it changed
  git remote set-url "$REMOTE_NAME" "$REPO_URL"
fi

# ── Build check (optional but recommended) ────────────────────
echo -e "${CYAN}🔨 Running build check...${NC}"
if npx turbo build --filter=admin 2>&1 | tail -5 | grep -q "successful"; then
  echo -e "${GREEN}✓ Build passed${NC}"
else
  echo -e "${RED}✗ Build failed — fix errors before deploying${NC}"
  exit 1
fi

# ── Commit if needed ─────────────────────────────────────────
if [ "${1:-}" = "--push-only" ]; then
  echo -e "${YELLOW}Skipping commit (--push-only)${NC}"
else
  if [ -n "$(git status --porcelain)" ]; then
    COMMIT_MSG="${1:-deploy: $(date +%Y-%m-%d_%H:%M:%S)}"
    echo -e "${CYAN}📝 Committing: ${COMMIT_MSG}${NC}"
    git add -A
    git commit -m "$COMMIT_MSG"
  else
    echo -e "${GREEN}✓ Working tree clean — nothing to commit${NC}"
  fi
fi

# ── Push ──────────────────────────────────────────────────────
echo -e "${CYAN}📤 Pushing to ${REMOTE_NAME}/${BRANCH}...${NC}"

# Use the personal remote (not origin which might be the office one)
if git push "$REMOTE_NAME" "$BRANCH" 2>&1; then
  echo ""
  echo -e "${GREEN}✅ Pushed successfully!${NC}"
  echo -e "${GREEN}   Vercel will auto-deploy from: ${REPO_URL}${NC}"
  echo ""
  echo -e "${CYAN}📊 Check deployment at:${NC}"
  echo -e "   https://vercel.com/dashboard"
  echo -e "   https://career-builder-admin.vercel.app/api/health"
else
  echo ""
  echo -e "${RED}✗ Push failed.${NC}"
  echo -e "${YELLOW}   If auth fails, run this ONCE to cache credentials:${NC}"
  echo -e "   git credential reject <<EOF"
  echo -e "   host=github.com"
  echo -e "   protocol=https"
  echo -e "   EOF"
  echo -e ""
  echo -e "${YELLOW}   Then try: gh auth login --hostname github.com -w${NC}"
  echo -e "${YELLOW}   Or use a Personal Access Token (PAT):${NC}"
  echo -e "   git remote set-url ${REMOTE_NAME} https://YOUR_PAT@github.com/Rohitmengji/career-builder.git"
  exit 1
fi
