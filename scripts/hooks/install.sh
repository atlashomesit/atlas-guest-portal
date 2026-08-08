#!/bin/bash
# TASK-7511: Install the atlas-guest-portal pre-push hook into the local .git/hooks
# directory. Run once per clone to enable TypeScript type checking on push.
#
# When sibling atlas-e2e/.githooks is present, prefer core.hooksPath so this clone
# uses the central hook suite. Otherwise, install repo-local pre-push.
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
GIT_DIR=$(git rev-parse --git-dir)
# Resolve worktree commondir to actual hooks location
if [ -f "$GIT_DIR/commondir" ]; then
  COMMON=$(cat "$GIT_DIR/commondir")
  # commondir is relative to GIT_DIR, resolve it
  HOOKS_DIR=$(cd "$GIT_DIR" && cd "$COMMON/.." && pwd)/.git/hooks
else
  HOOKS_DIR="$REPO_ROOT/.git/hooks"
fi

E2E_HOOKS="$(cd "$REPO_ROOT/.." && pwd)/atlas-e2e/.githooks"

if [ -d "$E2E_HOOKS" ]; then
  git -C "$REPO_ROOT" config core.hooksPath "$E2E_HOOKS"
  echo "Set core.hooksPath -> $E2E_HOOKS"
  echo "Note: Atlas-e2e pre-push applies to all repos. Repo-local typecheck is NOT bypassed."
  echo "Bypass with: git push --no-verify"
  exit 0
fi

SRC="$REPO_ROOT/scripts/hooks/pre-push"
DEST="$HOOKS_DIR/pre-push"

if [ ! -f "$SRC" ]; then
  echo "ERROR: $SRC not found. Are you in the atlas-guest-portal repo?"
  exit 1
fi

mkdir -p "$HOOKS_DIR"
cp "$SRC" "$DEST"
chmod +x "$DEST"
echo "Installed pre-push hook -> $DEST"
echo "Bypass with: git push --no-verify"
